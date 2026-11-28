import { FRAMEWORK_PRESETS, detectFrameworkFromPackageJson } from "@/lib/frameworks";
import type { FrameworkType } from "@/types/database";

export type IntelligenceSeverity = "blocker" | "warning" | "ok";

export interface IntelligenceFinding {
  id: string;
  category:
    | "framework"
    | "config_files"
    | "build_command"
    | "output_directory"
    | "env_vars"
    | "dependencies";
  severity: IntelligenceSeverity;
  title: string;
  detail: string;
  suggestion?: string;
}

export interface RequiredEnvVarCheck {
  key: string;
  source: string;
  configured: boolean;
}

export interface DeployIntelligenceReport {
  readiness: "ready" | "warnings" | "blocked";
  detectedFramework: FrameworkType;
  detectedPackageName: string | null;
  findings: IntelligenceFinding[];
  requiredEnvVars: RequiredEnvVarCheck[];
  recommendedConfig: {
    framework: FrameworkType;
    installCommand: string;
    buildCommand: string;
    outputDirectory: string;
    nodeVersion: "18" | "20" | "22" | "24";
  };
  disclaimer: string;
  analyzedAt: string;
}

export interface AnalyzeProjectContext {
  framework: FrameworkType;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  nodeVersion: string;
  rootFiles: string[];
  packageJsonRaw: string | null;
  nextConfigRaw?: string | null;
  viteConfigRaw?: string | null;
  envExampleRaw?: string | null;
  configuredEnvKeys: string[];
}

export function extractEnvKeysFromExample(envExampleRaw: string | null | undefined): string[] {
  if (!envExampleRaw) return [];
  const keys = new Set<string>();
  for (const rawLine of envExampleRaw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]{1,63})\s*=/);
    if (match?.[1]) {
      keys.add(match[1]);
    }
  }
  return Array.from(keys);
}

function parsePackageJson(raw: string | null): {
  valid: boolean;
  name: string | null;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  enginesNode: string | null;
} {
  if (!raw) {
    return {
      valid: false,
      name: null,
      scripts: {},
      dependencies: {},
      devDependencies: {},
      enginesNode: null,
    };
  }
  try {
    const pkg = JSON.parse(raw) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: { node?: string };
    };
    return {
      valid: true,
      name: pkg.name ?? null,
      scripts: pkg.scripts ?? {},
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      enginesNode: pkg.engines?.node ?? null,
    };
  } catch {
    return {
      valid: false,
      name: null,
      scripts: {},
      dependencies: {},
      devDependencies: {},
      enginesNode: null,
    };
  }
}

export function analyzeDeployReadiness(ctx: AnalyzeProjectContext): DeployIntelligenceReport {
  const findings: IntelligenceFinding[] = [];
  const lowerFiles = new Set(ctx.rootFiles.map((f) => f.toLowerCase()));
  const pkg = parsePackageJson(ctx.packageJsonRaw);
  const detectedPreset = pkg.valid ? detectFrameworkFromPackageJson(ctx.packageJsonRaw) : FRAMEWORK_PRESETS.static;
  const detectedFramework = detectedPreset.id;

  // 1. Framework detection vs configured preset
  if (detectedFramework !== ctx.framework && pkg.valid) {
    findings.push({
      id: "framework-mismatch",
      category: "framework",
      severity: "warning",
      title: `Detected "${detectedFramework}" while project is configured as "${ctx.framework}"`,
      detail: `package.json dependencies match ${detectedPreset.label}.`,
      suggestion: `Switch framework preset to "${detectedFramework}" or confirm custom commands match your repository.`,
    });
  } else {
    findings.push({
      id: "framework-ok",
      category: "framework",
      severity: "ok",
      title: `Framework verified: ${detectedPreset.label}`,
      detail: pkg.valid
        ? `Detected from package.json${pkg.name ? ` (${pkg.name})` : ""}.`
        : "Static site workspace (no package.json build pipeline required).",
    });
  }

  // 2. Configuration files checks
  const hasLockfile =
    lowerFiles.has("package-lock.json") ||
    lowerFiles.has("npm-shrinkwrap.json") ||
    lowerFiles.has("pnpm-lock.yaml") ||
    lowerFiles.has("yarn.lock");

  if (!pkg.valid && ctx.framework !== "static") {
    findings.push({
      id: "missing-package-json",
      category: "config_files",
      severity: ctx.packageJsonRaw ? "blocker" : "blocker",
      title: ctx.packageJsonRaw ? "Invalid package.json syntax" : "Missing package.json",
      detail: ctx.packageJsonRaw
        ? "package.json exists but could not be parsed as valid JSON."
        : `Framework "${ctx.framework}" expects a package.json file in the configured root directory.`,
      suggestion:
        "Verify rootDirectory or switch framework preset to Static HTML/CSS/JS if this repo is plain HTML.",
    });
  }

  if (ctx.framework === "static" && ctx.rootFiles.length > 0 && !lowerFiles.has("index.html")) {
    findings.push({
      id: "missing-static-index",
      category: "config_files",
      severity: "blocker",
      title: "Missing index.html entry file",
      detail: "Static deployments require an index.html file in the output directory.",
      suggestion: "Add index.html at the root directory or point outputDirectory to the folder containing index.html.",
    });
  }

  if (detectedFramework === "nextjs") {
    const hasNextConfig =
      Boolean(ctx.nextConfigRaw) ||
      lowerFiles.has("next.config.ts") ||
      lowerFiles.has("next.config.mjs") ||
      lowerFiles.has("next.config.js");

    if (!hasNextConfig) {
      findings.push({
        id: "missing-next-config",
        category: "config_files",
        severity: "warning",
        title: "Missing next.config file for static export",
        detail: "QuantumHost serves static Next.js exports (`output: 'export'`). No next.config.{ts,mjs,js} was found.",
        suggestion: "Add `output: 'export'` in next.config.ts so `next build` emits static HTML into `out/`.",
      });
    } else if (ctx.nextConfigRaw && !/output\s*:\s*['"]export['"]/.test(ctx.nextConfigRaw)) {
      findings.push({
        id: "nextjs-ssr-not-exported",
        category: "config_files",
        severity: "blocker",
        title: "Next.js static export (`output: 'export'`) not detected",
        detail: "QuantumHost's static edge hosting serves exported bundles from `out/` rather than a persistent Node SSR server.",
        suggestion: "Set `output: 'export'` in next.config or verify your build command exports static files to `out`.",
      });
    }
  }

  if (detectedFramework === "vite" && ctx.rootFiles.length > 0 && !lowerFiles.has("index.html")) {
    findings.push({
      id: "missing-vite-index",
      category: "config_files",
      severity: "blocker",
      title: "Missing Vite root index.html",
      detail: "Vite builds require index.html as the application entry point in the project root.",
      suggestion: "Ensure index.html exists in rootDirectory.",
    });
  }

  // 3. Build & Install command validity
  const trimmedInstall = ctx.installCommand.trim();
  const trimmedBuild = ctx.buildCommand.trim();

  if (trimmedInstall === "npm ci" && pkg.valid && !lowerFiles.has("package-lock.json") && !lowerFiles.has("npm-shrinkwrap.json")) {
    findings.push({
      id: "npm-ci-no-lockfile",
      category: "build_command",
      severity: "warning",
      title: "Install command uses `npm ci` without package-lock.json",
      detail: "`npm ci` fails immediately if package-lock.json is absent in the repository.",
      suggestion: "Commit package-lock.json or change the install command to `npm install`.",
    });
  } else if (trimmedInstall && hasLockfile) {
    findings.push({
      id: "install-cmd-ok",
      category: "build_command",
      severity: "ok",
      title: "Install command & lockfile aligned",
      detail: `Install step "${trimmedInstall}" matches repository lockfile presence.`,
    });
  }

  if (pkg.valid && trimmedBuild === "npm run build" && !pkg.scripts.build) {
    findings.push({
      id: "missing-build-script",
      category: "build_command",
      severity: "blocker",
      title: "Missing `scripts.build` in package.json",
      detail: 'Build command is configured as "npm run build", but package.json has no "build" script.',
      suggestion: 'Add `"build": "..."` to package.json scripts or update the Build Command field.',
    });
  } else if (!trimmedBuild && pkg.valid && ctx.framework !== "static") {
    findings.push({
      id: "empty-build-cmd",
      category: "build_command",
      severity: "warning",
      title: "Build command is empty",
      detail: `No build command is configured for ${ctx.framework}; raw files will be uploaded directly.`,
    });
  }

  // 4. Output directory configuration check
  const trimmedOut = ctx.outputDirectory.trim();
  const expectedOut = FRAMEWORK_PRESETS[ctx.framework]?.outputDirectory ?? "dist";
  if (!trimmedOut) {
    findings.push({
      id: "empty-output-dir",
      category: "output_directory",
      severity: "blocker",
      title: "Output directory is blank",
      detail: "Build worker needs an explicit relative directory path to collect static assets.",
      suggestion: `Set output directory to "${expectedOut}".`,
    });
  } else if (trimmedOut.includes("..") || trimmedOut.startsWith("/")) {
    findings.push({
      id: "unsafe-output-dir",
      category: "output_directory",
      severity: "blocker",
      title: "Unsafe output directory path",
      detail: `Output directory "${trimmedOut}" must stay inside the isolated build workspace.`,
      suggestion: `Use a relative directory such as "${expectedOut}".`,
    });
  } else if (detectedFramework === "vite" && ctx.framework === "vite" && trimmedOut !== "dist" && !ctx.viteConfigRaw?.includes(trimmedOut)) {
    findings.push({
      id: "vite-output-mismatch",
      category: "output_directory",
      severity: "warning",
      title: `Vite defaults to "dist" but outputDirectory is "${trimmedOut}"`,
      detail: "Unless vite.config sets build.outDir to this path, artifact collection may miss files.",
      suggestion: 'Verify build.outDir in vite.config or set outputDirectory to "dist".',
    });
  } else if (detectedFramework === "nextjs" && trimmedOut !== "out") {
    findings.push({
      id: "nextjs-output-mismatch",
      category: "output_directory",
      severity: "warning",
      title: `Next.js static export emits "out" (configured "${trimmedOut}")`,
      detail: "Standard Next.js `output: 'export'` writes static files to `out/`.",
      suggestion: 'Set outputDirectory to "out".',
    });
  } else {
    findings.push({
      id: "output-dir-ok",
      category: "output_directory",
      severity: "ok",
      title: `Output directory configured: "${trimmedOut}"`,
      detail: "Relative path validated against workspace boundary and framework preset.",
    });
  }

  // 5. Required environment variables (names only)
  const exampleKeys = extractEnvKeysFromExample(ctx.envExampleRaw);
  const configuredSet = new Set(ctx.configuredEnvKeys.map((k) => k.trim()));
  const requiredEnvVars: RequiredEnvVarCheck[] = exampleKeys.map((key) => ({
    key,
    source: ".env.example",
    configured: configuredSet.has(key),
  }));

  const missingEnvVars = requiredEnvVars.filter((v) => !v.configured);
  if (missingEnvVars.length > 0) {
    findings.push({
      id: "missing-env-vars",
      category: "env_vars",
      severity: "warning",
      title: `${missingEnvVars.length} variable${missingEnvVars.length > 1 ? "s" : ""} from .env.example not configured`,
      detail: `Missing in QuantumHost project settings: ${missingEnvVars.map((v) => v.key).join(", ")}.`,
      suggestion: "Add required build/public variables in Project -> Environment Variables before deploying.",
    });
  } else if (requiredEnvVars.length > 0) {
    findings.push({
      id: "env-vars-ok",
      category: "env_vars",
      severity: "ok",
      title: `All ${requiredEnvVars.length} .env.example variables are configured`,
      detail: "Configured keys will be decrypted only inside the isolated worker environment.",
    });
  }

  // 6. Common dependency & runtime issues
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (pkg.enginesNode) {
    const matchMajor = pkg.enginesNode.match(/(\d{2})/);
    if (matchMajor?.[1] && matchMajor[1] !== ctx.nodeVersion) {
      findings.push({
        id: "node-engine-mismatch",
        category: "dependencies",
        severity: "warning",
        title: `package.json engines.node ("${pkg.enginesNode}") differs from Node ${ctx.nodeVersion}`,
        detail: `Project is set to Node ${ctx.nodeVersion}, while package.json specifies ${pkg.enginesNode}.`,
        suggestion: "Align Node.js version in Build & Settings with package.json engines.node.",
      });
    }
  }

  if ("sharp" in allDeps || "canvas" in allDeps || "sqlite3" in allDeps || "better-sqlite3" in allDeps) {
    findings.push({
      id: "native-addons-warning",
      category: "dependencies",
      severity: "warning",
      title: "Native C/C++ addon dependency detected",
      detail: "Packages like sharp/canvas/better-sqlite3 require build toolchain binaries in the worker container.",
      suggestion: "Verify native addons build cleanly under Linux Alpine/Debian Node workers if build fails.",
    });
  }

  if (pkg.scripts.build?.includes("tsc") && !("typescript" in allDeps)) {
    findings.push({
      id: "missing-typescript-dep",
      category: "dependencies",
      severity: "blocker",
      title: "Build script invokes `tsc` without typescript dependency",
      detail: "Scripts referencing TypeScript compiler will fail during clean `npm ci` builds.",
      suggestion: "Add `typescript` to devDependencies in package.json.",
    });
  }

  const hasBlocker = findings.some((f) => f.severity === "blocker");
  const hasWarning = findings.some((f) => f.severity === "warning");
  const recommendedPreset = FRAMEWORK_PRESETS[detectedFramework] ?? FRAMEWORK_PRESETS.static;

  const recommendedInstall =
    recommendedPreset.installCommand === "npm ci" &&
    pkg.valid &&
    !lowerFiles.has("package-lock.json") &&
    !lowerFiles.has("npm-shrinkwrap.json")
      ? "npm install"
      : recommendedPreset.installCommand;

  const majorEngine = pkg.enginesNode?.match(/(\d{2})/)?.[1];
  const recommendedNode: "18" | "20" | "22" | "24" =
    majorEngine === "18" || majorEngine === "20" || majorEngine === "22" || majorEngine === "24"
      ? majorEngine
      : (ctx.nodeVersion as "18" | "20" | "22" | "24") || "20";

  return {
    readiness: hasBlocker ? "blocked" : hasWarning ? "warnings" : "ready",
    detectedFramework,
    detectedPackageName: pkg.name,
    findings,
    requiredEnvVars,
    recommendedConfig: {
      framework: detectedFramework,
      installCommand: recommendedInstall,
      buildCommand: pkg.scripts.build ? "npm run build" : recommendedPreset.buildCommand,
      outputDirectory: recommendedPreset.outputDirectory,
      nodeVersion: recommendedNode,
    },
    disclaimer:
      "Pre-deployment intelligence checks static repository files and settings, and cannot predict all runtime or external npm registry failures.",
    analyzedAt: new Date().toISOString(),
  };
}
