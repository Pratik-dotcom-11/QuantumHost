import { describe, expect, it } from "vitest";
import { detectFrameworkFromPackageJson } from "../src/lib/frameworks";

describe("Framework auto-detection", () => {
  it("detects Next.js", () => {
    const preset = detectFrameworkFromPackageJson(
      JSON.stringify({ dependencies: { next: "16.0.0", react: "19.0.0" } })
    );
    expect(preset.id).toBe("nextjs");
    expect(preset.outputDirectory).toBe("out");
  });

  it("detects Vite", () => {
    const preset = detectFrameworkFromPackageJson(
      JSON.stringify({ devDependencies: { vite: "^6.0.0" } })
    );
    expect(preset.id).toBe("vite");
    expect(preset.outputDirectory).toBe("dist");
  });

  it("falls back to static when package.json is absent", () => {
    const preset = detectFrameworkFromPackageJson(null);
    expect(preset.id).toBe("static");
    expect(preset.outputDirectory).toBe(".");
  });
});
