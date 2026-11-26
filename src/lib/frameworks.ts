import type { FrameworkType } from "@/types/database";

export interface FrameworkPreset {
  id: FrameworkType;
  label: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
}

export const FRAMEWORK_PRESETS: Record<FrameworkType, FrameworkPreset> = {
  nextjs: {
    id: "nextjs",
    label: "Next.js (Static Export)",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    outputDirectory: "out",
  },
  vite: {
    id: "vite",
    label: "Vite",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    outputDirectory: "dist",
  },
  react: {
    id: "react",
    label: "React (CRA)",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    outputDirectory: "build",
  },
  astro: {
    id: "astro",
    label: "Astro",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    outputDirectory: "dist",
  },
  static: {
    id: "static",
    label: "Static HTML / CSS / JS",
    installCommand: "",
    buildCommand: "",
    outputDirectory: ".",
  },
  node: {
    id: "node",
    label: "Node.js Build Artifact",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    outputDirectory: "dist",
  },
  custom: {
    id: "custom",
    label: "Custom Preset",
    installCommand: "npm ci",
    buildCommand: "npm run build",
    outputDirectory: "dist",
  },
};

export function detectFrameworkFromPackageJson(pkgJsonRaw: string | null): FrameworkPreset {
  if (!pkgJsonRaw) {
    return FRAMEWORK_PRESETS.static;
  }

  try {
    const pkg = JSON.parse(pkgJsonRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    if ("next" in allDeps) return FRAMEWORK_PRESETS.nextjs;
    if ("astro" in allDeps) return FRAMEWORK_PRESETS.astro;
    if ("vite" in allDeps) return FRAMEWORK_PRESETS.vite;
    if ("react-scripts" in allDeps) return FRAMEWORK_PRESETS.react;
    if (pkg.scripts?.build) return FRAMEWORK_PRESETS.node;
    return FRAMEWORK_PRESETS.static;
  } catch {
    return FRAMEWORK_PRESETS.static;
  }
}
