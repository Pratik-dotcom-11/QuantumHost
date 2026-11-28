import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACTIVE_DEPLOYMENT_STATES,
  TERMINAL_DEPLOYMENT_STATES,
  assertDeploymentTransition,
  canTransitionDeploymentStatus,
  isActiveDeploymentStatus,
  isTerminalDeploymentStatus,
} from "../src/lib/deployments/lifecycle";
import { readArtifactAsset, uploadArtifactDirectory } from "../src/lib/storage/artifacts";
import { resolveSafeSubdir, runIsolatedCommand } from "../src/lib/worker/build-runner";
import type { DeploymentStatus } from "../src/types/database";

function minimalSandboxEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    PATHEXT: process.env.PATHEXT,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: process.env.HOME || process.env.USERPROFILE,
    NODE_ENV: "production",
    NODE_OPTIONS: "--max-old-space-size=1024",
  };
}

describe("Phase 5 Deployment Engine & Lifecycle", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    tempDirs.length = 0;
  });

  it("enforces all 11 lifecycle states and valid transitions", () => {
    expect(ACTIVE_DEPLOYMENT_STATES).toEqual([
      "queued",
      "initializing",
      "cloning",
      "analyzing",
      "building",
      "uploading",
      "deploying",
      "verifying",
    ]);
    expect(TERMINAL_DEPLOYMENT_STATES).toEqual(["ready", "failed", "cancelled"]);

    const happyPath: DeploymentStatus[] = [
      "queued",
      "initializing",
      "cloning",
      "analyzing",
      "building",
      "uploading",
      "deploying",
      "verifying",
      "ready",
    ];
    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(canTransitionDeploymentStatus(from, to)).toBe(true);
      expect(() => assertDeploymentTransition(from, to)).not.toThrow();
    }

    for (const active of ACTIVE_DEPLOYMENT_STATES) {
      expect(isActiveDeploymentStatus(active)).toBe(true);
      expect(isTerminalDeploymentStatus(active)).toBe(false);
      expect(canTransitionDeploymentStatus(active, "cancelled")).toBe(true);
      expect(canTransitionDeploymentStatus(active, "failed")).toBe(true);
    }

    for (const terminal of TERMINAL_DEPLOYMENT_STATES) {
      expect(isActiveDeploymentStatus(terminal)).toBe(false);
      expect(isTerminalDeploymentStatus(terminal)).toBe(true);
    }

    // Reject illegal jumps & terminal state mutations
    expect(() => assertDeploymentTransition("queued", "ready")).toThrow(/Invalid deployment state transition/);
    expect(() => assertDeploymentTransition("ready", "building")).toThrow(/Invalid deployment state transition/);
    expect(() => assertDeploymentTransition("failed", "ready")).toThrow(/Invalid deployment state transition/);
    expect(() => assertDeploymentTransition("cancelled", "queued")).toThrow(/Invalid deployment state transition/);
  });

  it("blocks path escapes, redacts injected secrets, and kills timed-out builds", async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "qh-sec-"));
    tempDirs.push(workDir);

    expect(resolveSafeSubdir(workDir, "apps/web")).toBe(path.resolve(workDir, "apps/web"));
    expect(resolveSafeSubdir(workDir, ".")).toBe(workDir);
    expect(() => resolveSafeSubdir(workDir, "../../etc")).toThrow(/escapes workspace/);

    const loggedLines: string[] = [];
    const secretToken = "ghs_SUPER_SECRET_INSTALL_TOKEN_12345";

    await runIsolatedCommand({
      command: `node -e "console.log('token=${secretToken}'); console.log('envKeys=' + Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY))"`,
      cwd: workDir,
      env: minimalSandboxEnv(),
      timeoutMs: 10000,
      redactTokens: [secretToken],
      onLine: async (line) => {
        loggedLines.push(line);
      },
    });

    expect(loggedLines.some((line) => line.includes("[REDACTED]"))).toBe(true);
    expect(loggedLines.some((line) => line.includes(secretToken))).toBe(false);
    expect(loggedLines.some((line) => line.includes("envKeys=false"))).toBe(true);

    await expect(
      runIsolatedCommand({
        command: `node -e "setTimeout(() => {}, 5000)"`,
        cwd: workDir,
        env: minimalSandboxEnv(),
        timeoutMs: 150,
        onLine: async () => undefined,
      })
    ).rejects.toThrow(/timed out/);
  });

  it("packages and verifies a real static HTML/CSS/JS website bundle", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qh-static-store-"));
    const siteDir = await fs.mkdtemp(path.join(os.tmpdir(), "qh-static-site-"));
    tempDirs.push(storageRoot, siteDir);

    process.env.ARTIFACT_STORAGE_PROVIDER = "local";
    process.env.LOCAL_STORAGE_DIR = storageRoot;

    await fs.writeFile(
      path.join(siteDir, "index.html"),
      '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><h1>Static Portfolio</h1><script src="/app.js"></script></body></html>',
      "utf8"
    );
    await fs.writeFile(path.join(siteDir, "styles.css"), "body { background: #0c0a08; color: #f4ba4a; }", "utf8");
    await fs.writeFile(path.join(siteDir, "app.js"), "window.__STATIC_READY__ = true;", "utf8");

    const upload = await uploadArtifactDirectory("proj-static", "dep-static-1", siteDir);
    expect(upload.fileCount).toBe(3);
    expect(upload.sizeBytes).toBeGreaterThan(50);

    const html = await readArtifactAsset(upload.provider, upload.artifactKey, []);
    const css = await readArtifactAsset(upload.provider, upload.artifactKey, ["styles.css"]);
    const js = await readArtifactAsset(upload.provider, upload.artifactKey, ["app.js"]);

    expect(html?.contentType).toContain("text/html");
    expect(Buffer.from(html!.bytes).toString("utf8")).toContain("Static Portfolio");
    expect(css?.contentType).toContain("text/css");
    expect(js?.contentType).toContain("javascript");
    expect(Buffer.from(js!.bytes).toString("utf8")).toContain("__STATIC_READY__");
  });

  it("builds a real Vite application in an isolated directory and verifies uploaded artifacts", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qh-vite-store-"));
    const viteAppDir = await fs.mkdtemp(path.join(os.tmpdir(), "qh-vite-app-"));
    tempDirs.push(storageRoot, viteAppDir);

    process.env.ARTIFACT_STORAGE_PROVIDER = "local";
    process.env.LOCAL_STORAGE_DIR = storageRoot;

    await fs.writeFile(
      path.join(viteAppDir, "package.json"),
      JSON.stringify({ name: "qh-vite-fixture", private: true, type: "module" }),
      "utf8"
    );
    await fs.writeFile(
      path.join(viteAppDir, "index.html"),
      '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>',
      "utf8"
    );
    await fs.mkdir(path.join(viteAppDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(viteAppDir, "src", "main.js"),
      'document.querySelector("#app").textContent = "QuantumHost Vite Ready";',
      "utf8"
    );

    const viteBin = path.resolve(process.cwd(), "node_modules", "vite", "bin", "vite.js");
    const buildLogs: string[] = [];

    await runIsolatedCommand({
      command: `node "${viteBin}" build`,
      cwd: viteAppDir,
      env: minimalSandboxEnv(),
      timeoutMs: 30000,
      onLine: async (line) => {
        buildLogs.push(line);
      },
    });

    const distDir = path.join(viteAppDir, "dist");
    const distEntries = await fs.readdir(path.join(distDir, "assets"));
    const jsBundle = distEntries.find((name) => name.endsWith(".js"));
    expect(jsBundle).toBeTruthy();

    const upload = await uploadArtifactDirectory("proj-vite", "dep-vite-1", distDir);
    expect(upload.fileCount).toBeGreaterThanOrEqual(2);

    const indexAsset = await readArtifactAsset(upload.provider, upload.artifactKey, []);
    expect(indexAsset?.contentType).toContain("text/html");
    const indexBody = Buffer.from(indexAsset!.bytes).toString("utf8");
    expect(indexBody).toContain(`/assets/${jsBundle}`);

    const bundledJsAsset = await readArtifactAsset(upload.provider, upload.artifactKey, ["assets", jsBundle!]);
    expect(bundledJsAsset?.contentType).toContain("javascript");
    expect(Buffer.from(bundledJsAsset!.bytes).toString("utf8")).toContain("QuantumHost Vite Ready");
    expect(buildLogs.some((l) => l.includes("built in"))).toBe(true);
  }, 30000);
});
