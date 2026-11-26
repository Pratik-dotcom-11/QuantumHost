import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readArtifactAsset, uploadArtifactDirectory } from "../src/lib/storage/artifacts";

describe("Local object storage artifact pipeline", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    tempDirs.length = 0;
  });

  it("uploads build output and resolves static routes while blocking traversal", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qh-store-"));
    const buildOut = await fs.mkdtemp(path.join(os.tmpdir(), "qh-out-"));
    tempDirs.push(storageRoot, buildOut);

    process.env.ARTIFACT_STORAGE_PROVIDER = "local";
    process.env.LOCAL_STORAGE_DIR = storageRoot;

    await fs.writeFile(path.join(buildOut, "index.html"), "<h1>QuantumHost Live</h1>", "utf8");
    await fs.mkdir(path.join(buildOut, "assets"), { recursive: true });
    await fs.writeFile(path.join(buildOut, "assets", "app.js"), "console.log('ok');", "utf8");

    const result = await uploadArtifactDirectory("proj-1", "dep-1", buildOut);
    expect(result.provider).toBe("local");
    expect(result.fileCount).toBe(2);
    expect(result.sizeBytes).toBeGreaterThan(0);

    const rootHtml = await readArtifactAsset("local", result.artifactKey, undefined);
    expect(rootHtml?.contentType).toContain("text/html");
    expect(Buffer.from(rootHtml!.bytes).toString("utf8")).toContain("QuantumHost Live");

    const jsAsset = await readArtifactAsset("local", result.artifactKey, ["assets", "app.js"]);
    expect(jsAsset?.contentType).toContain("javascript");

    // Path traversal segments ("..") are stripped safely
    const spaFallback = await readArtifactAsset("local", result.artifactKey, ["..", "..", "etc", "passwd"]);
    expect(spaFallback?.resolvedPath).toBe("index.html");
  });
});
