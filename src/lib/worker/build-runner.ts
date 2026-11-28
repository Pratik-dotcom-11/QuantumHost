import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decryptSecret } from "@/lib/crypto";
import { getPublicEnv } from "@/lib/env";
import { detectFrameworkFromPackageJson } from "@/lib/frameworks";
import { resolveConnectionToken } from "@/lib/github/client";
import { resolveHostingProviderAdapter } from "@/lib/deployments/hosting-adapter";
import { assertDeploymentTransition } from "@/lib/deployments/lifecycle";
import type { BuildJobPayload } from "@/lib/queue/bullmq";
import { uploadArtifactDirectory } from "@/lib/storage/artifacts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeploymentStatus, StorageProviderType } from "@/types/database";

export type LogStage =
  | "queue"
  | "init"
  | "clone"
  | "analyze"
  | "install"
  | "build"
  | "upload"
  | "deploy"
  | "verify"
  | "system";

export type LogLevel = "info" | "warn" | "error" | "debug" | "system";

export function resolveSafeSubdir(baseDir: string, relativeDir: string): string {
  const cleaned = relativeDir.trim() || ".";
  const resolved = path.resolve(baseDir, cleaned);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    throw new Error(`Invalid directory path "${relativeDir}" escapes workspace.`);
  }
  return resolved;
}

export class SerializedLogWriter {
  private seq = 10;
  private queue: Promise<void> = Promise.resolve();
  private readonly admin = createAdminClient();

  constructor(
    private readonly deploymentId: string,
    private readonly projectId: string,
    private readonly userId: string
  ) {}

  log(stage: LogStage, level: LogLevel, message: string): Promise<void> {
    const trimmed = message.trimEnd();
    if (!trimmed) return Promise.resolve();

    this.queue = this.queue
      .then(async () => {
        this.seq += 1;
        await this.admin.from("deployment_logs").insert({
          deployment_id: this.deploymentId,
          project_id: this.projectId,
          user_id: this.userId,
          seq: this.seq,
          level,
          stage,
          message: trimmed.slice(0, 4000),
        });
      })
      .catch(() => {
        // Keep logging pipeline resilient
      });

    return this.queue;
  }

  async flush(): Promise<void> {
    await this.queue;
  }
}

export class BuildCancelledError extends Error {
  constructor() {
    super("Deployment was cancelled by user.");
    this.name = "BuildCancelledError";
  }
}

export class DeterministicBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeterministicBuildError";
  }
}

export async function runIsolatedCommand(params: {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  onLine: (line: string, isError: boolean) => Promise<void>;
  redactTokens?: string[];
  maxLogLines?: number;
}): Promise<void> {
  const sanitize = (text: string) => {
    let out = text;
    for (const token of params.redactTokens ?? []) {
      if (token && token.length > 4) {
        out = out.split(token).join("[REDACTED]");
      }
    }
    return out;
  };

  let lineCount = 0;
  const maxLines = params.maxLogLines ?? 2500;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timedOut = false;

    const child = spawn(params.command, [], {
      cwd: params.cwd,
      shell: true,
      detached: process.platform !== "win32",
      env: params.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const pendingLogs: Promise<void>[] = [];
    const finishWithError = async (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await Promise.allSettled(pendingLogs);
      reject(err);
    };

    const killProcessTree = () => {
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
          stdio: "ignore",
        });
        killer.on("error", () => undefined);
        killer.unref();
      } else if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // Fall back to direct child kill below
        }
      }
      try {
        child.kill("SIGKILL");
      } catch {
        // Ignore if already exited
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree();
      void finishWithError(
        new DeterministicBuildError(`Build step timed out after ${params.timeoutMs}ms`)
      );
    }, params.timeoutMs);

    const handleChunk = (chunk: Buffer, isError: boolean) => {
      const lines = sanitize(chunk.toString("utf8")).split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        lineCount += 1;
        if (lineCount <= maxLines) {
          pendingLogs.push(params.onLine(line, isError));
        } else if (lineCount === maxLines + 1) {
          pendingLogs.push(params.onLine("... log output truncated after safety limit.", true));
        }
      }
    };

    child.stdout?.on("data", (d: Buffer) => handleChunk(d, false));
    child.stderr?.on("data", (d: Buffer) => handleChunk(d, true));

    child.on("error", (err) => {
      void finishWithError(err);
    });

    child.on("close", async (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await Promise.allSettled(pendingLogs);
      if (timedOut) {
        reject(new DeterministicBuildError(`Build step timed out after ${params.timeoutMs}ms`));
      } else if (code !== 0) {
        reject(new DeterministicBuildError(`Command exited with status code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

function buildDockerCommand(params: {
  stage: "install" | "build";
  workDir: string;
  nodeVersion: string;
  innerCommand: string;
  cpus: string;
  memory: string;
}): string {
  const networkFlag = params.stage === "build" ? "--network=none" : "--network=bridge";
  const escaped = params.innerCommand.replace(/"/g, '\\"');
  return [
    "docker run --rm",
    "--user 1000:1000",
    `--cpus=${params.cpus}`,
    `--memory=${params.memory}`,
    "--pids-limit=256",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true",
    networkFlag,
    `-v "${params.workDir}:/app"`,
    "-w /app",
    `node:${params.nodeVersion}-alpine`,
    `sh -c "${escaped}"`,
  ].join(" ");
}

export interface ExecuteBuildOptions {
  strictHttpVerify?: boolean;
  /** Optional local directory override for self-contained end-to-end tests */
  localSourceOverrideDir?: string;
}

export async function executeDeploymentLifecycle(
  payload: BuildJobPayload,
  options: ExecuteBuildOptions = {}
): Promise<{
  status: "ready";
  previewUrl: string;
  productionUrl: string | null;
  artifactKey: string;
  sizeBytes: number;
  fileCount: number;
  durationMs: number;
}> {
  const { deploymentId, projectId, userId, environment } = payload;
  const admin = createAdminClient();
  const logger = new SerializedLogWriter(deploymentId, projectId, userId);
  const startedAt = Date.now();
  const workspaceDir = path.join(os.tmpdir(), "qh-builds", deploymentId);
  const redactTokens: string[] = [];

  const timeoutMs = Number.parseInt(process.env.BUILD_TIMEOUT_MS || "180000", 10);
  const maxOutputBytes = Number.parseInt(process.env.BUILD_MAX_OUTPUT_BYTES || "52428800", 10);
  const useDocker = process.env.DOCKER_ISOLATION === "true";
  const dockerCpus = process.env.BUILD_DOCKER_CPUS?.trim() || "1";
  const dockerMemory = process.env.BUILD_DOCKER_MEMORY?.trim() || "1g";

  let currentStatus: DeploymentStatus = "queued";

  async function transition(next: DeploymentStatus, extraFields?: Record<string, unknown>) {
    // Check DB cancellation before transitioning forward
    const { data: latest } = await admin
      .from("deployments")
      .select("status")
      .eq("id", deploymentId)
      .single();

    if (latest?.status === "cancelled") {
      throw new BuildCancelledError();
    }

    assertDeploymentTransition(currentStatus, next);
    await admin
      .from("deployments")
      .update({ status: next, ...extraFields })
      .eq("id", deploymentId);
    currentStatus = next;
  }

  try {
    await transition("initializing", { started_at: new Date().toISOString() });
    await logger.log(
      "init",
      "system",
      `Initialized isolated build environment (docker=${useDocker}, timeout=${timeoutMs}ms).`
    );

    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectErr || !project) {
      throw new DeterministicBuildError("Project configuration not found or unauthorized.");
    }

    const { data: dep } = await admin
      .from("deployments")
      .select("git_branch, git_commit_sha")
      .eq("id", deploymentId)
      .single();

    const branch = dep?.git_branch || project.default_branch;

    // 1. CLONING
    await transition("cloning");
    await fs.mkdir(workspaceDir, { recursive: true });
    const repoDir = path.join(workspaceDir, "repo");

    // Clean sanitized environment — excludes control-plane secrets completely
    const minimalSysEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH || "",
      HOME: workspaceDir,
      TEMP: os.tmpdir(),
      TMP: os.tmpdir(),
      SystemRoot: process.env.SystemRoot || "C:\\Windows",
      NODE_ENV: "production",
      CI: "true",
      NODE_OPTIONS: "--max-old-space-size=1024",
    };

    if (options.localSourceOverrideDir) {
      await logger.log("clone", "info", `Copying source snapshot into isolated sandbox...`);
      await fs.cp(options.localSourceOverrideDir, repoDir, { recursive: true });
    } else {
      let gitCloneUrl = project.repo_url || `https://github.com/${project.repo_full_name}.git`;
      if (project.github_connection_id) {
        const { data: conn } = await admin
          .from("github_connections")
          .select("id, provider_type, installation_id, encrypted_access_token, token_expires_at")
          .eq("id", project.github_connection_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (conn) {
          const token = await resolveConnectionToken(conn, async (enc, exp) => {
            await admin
              .from("github_connections")
              .update({ encrypted_access_token: enc, token_expires_at: exp })
              .eq("id", conn.id);
          });
          redactTokens.push(token);
          gitCloneUrl = `https://x-access-token:${token}@github.com/${project.repo_full_name}.git`;
        }
      }

      await logger.log(
        "clone",
        "info",
        `Cloning ${project.repo_full_name} (branch: ${branch}) into isolated workspace...`
      );
      await runIsolatedCommand({
        command: `git clone --depth 1 --branch "${branch}" "${gitCloneUrl}" repo`,
        cwd: workspaceDir,
        env: minimalSysEnv,
        timeoutMs: 60_000,
        redactTokens,
        onLine: (line, isErr) => logger.log("clone", isErr ? "warn" : "info", line),
      });
    }

    const workDir = resolveSafeSubdir(repoDir, project.root_directory);

    // 2. ANALYZING
    await transition("analyzing");
    let pkgJsonRaw: string | null = null;
    try {
      pkgJsonRaw = await fs.readFile(path.join(workDir, "package.json"), "utf8");
    } catch {
      pkgJsonRaw = null;
    }
    const detectedPreset = detectFrameworkFromPackageJson(pkgJsonRaw);
    await logger.log(
      "analyze",
      "info",
      `Framework configured: ${project.framework} (detected package preset: ${detectedPreset.id}, output: ${project.output_directory}).`
    );

    // Decrypt project env vars strictly for child process buildEnv
    const { data: envRows } = await admin
      .from("project_env_vars")
      .select("key, encrypted_value, environment")
      .eq("project_id", projectId)
      .in("environment", [environment, "all"]);

    const buildEnv: NodeJS.ProcessEnv = { ...minimalSysEnv };
    for (const row of envRows ?? []) {
      try {
        const decrypted = decryptSecret(row.encrypted_value);
        buildEnv[row.key] = decrypted;
        redactTokens.push(decrypted);
      } catch {
        await logger.log("analyze", "warn", `Could not decrypt env var ${row.key}; skipping.`);
      }
    }

    // 3. BUILDING (Install + Build)
    if (project.install_command.trim() || project.build_command.trim()) {
      await transition("building");

      if (project.install_command.trim()) {
        await logger.log("install", "info", `Running install command: ${project.install_command}`);
        const installCmd = useDocker
          ? buildDockerCommand({
              stage: "install",
              workDir,
              nodeVersion: project.node_version,
              innerCommand: project.install_command,
              cpus: dockerCpus,
              memory: dockerMemory,
            })
          : project.install_command;

        await runIsolatedCommand({
          command: installCmd,
          cwd: workDir,
          env: buildEnv,
          timeoutMs,
          redactTokens,
          onLine: (line, isErr) => logger.log("install", isErr ? "warn" : "info", line),
        });
      }

      if (project.build_command.trim()) {
        await logger.log("build", "info", `Running build command: ${project.build_command}`);
        const buildCmd = useDocker
          ? buildDockerCommand({
              stage: "build",
              workDir,
              nodeVersion: project.node_version,
              innerCommand: project.build_command,
              cpus: dockerCpus,
              memory: dockerMemory,
            })
          : project.build_command;

        await runIsolatedCommand({
          command: buildCmd,
          cwd: workDir,
          env: buildEnv,
          timeoutMs,
          redactTokens,
          onLine: (line, isErr) => logger.log("build", isErr ? "warn" : "info", line),
        });
      }
    }

    // 4. UPLOADING
    await transition("uploading");
    const outDir = resolveSafeSubdir(workDir, project.output_directory);
    await logger.log("upload", "info", `Validating and uploading artifacts from "${project.output_directory}"...`);

    const artifact = await uploadArtifactDirectory(
      projectId,
      deploymentId,
      outDir,
      maxOutputBytes
    );
    await logger.log(
      "upload",
      "info",
      `Uploaded ${artifact.fileCount} files (${artifact.sizeBytes} bytes) to ${artifact.provider}.`
    );

    // 5. DEPLOYING (Hosting Provider Adapter Preview Registration)
    await transition("deploying");
    const adapter = resolveHostingProviderAdapter();
    const { appUrl } = getPublicEnv();
    const activation = await adapter.activatePreview({
      deploymentId,
      projectId,
      projectSlug: project.slug,
      environment,
      storageProvider: artifact.provider as StorageProviderType,
      artifactKey: artifact.artifactKey,
      artifactSizeBytes: artifact.sizeBytes,
      appUrl,
    });
    await logger.log(
      "deploy",
      "info",
      `Registered immutable preview via ${adapter.name} -> ${activation.previewUrl}`
    );

    // 6. VERIFYING (verify stored artifacts & preview endpoint BEFORE promoting production)
    await transition("verifying");
    const verification = await adapter.verify({
      deploymentId,
      storageProvider: artifact.provider as StorageProviderType,
      artifactKey: artifact.artifactKey,
      verifyUrl: activation.verifyTargetUrl,
      strictHttp: options.strictHttpVerify,
    });
    await logger.log(
      "verify",
      "info",
      verification.httpChecked
        ? `Verified artifact entry (${verification.entryPath}) & HTTP ${verification.httpStatus} in ${verification.latencyMs}ms.`
        : `Verified immutable artifact entry (${verification.entryPath}) in ${artifact.provider}.`
    );

    // 7. READY (mark ready before atomic production pointer promotion)
    const durationMs = Date.now() - startedAt;
    const nowIso = new Date().toISOString();
    await transition("ready", {
      build_duration_ms: durationMs,
      finished_at: nowIso,
      verified_at: nowIso,
    });

    // 8. Promote active production deployment atomically after verified READY state
    if (environment === "production") {
      const promoted = await adapter.promoteProduction({
        projectId,
        projectSlug: project.slug,
        deploymentId,
        appUrl,
      });
      await logger.log(
        "deploy",
        "info",
        `Promoted production traffic to deployment ${promoted.activeDeploymentId} (${promoted.productionUrl}).`
      );
    }

    await admin.from("resource_usage_events").insert([
      {
        user_id: userId,
        project_id: projectId,
        deployment_id: deploymentId,
        metric_type: "build_seconds",
        value: Number((durationMs / 1000).toFixed(2)),
        metadata: { environment, framework: project.framework },
      },
      {
        user_id: userId,
        project_id: projectId,
        deployment_id: deploymentId,
        metric_type: "storage_bytes",
        value: artifact.sizeBytes,
        metadata: { provider: artifact.provider, fileCount: artifact.fileCount },
      },
    ]);

    await logger.log(
      "deploy",
      "system",
      `Deployment READY in ${(durationMs / 1000).toFixed(2)}s (${artifact.fileCount} files, ${artifact.sizeBytes} bytes via ${artifact.provider}).`
    );
    await logger.flush();

    return {
      status: "ready",
      previewUrl: activation.previewUrl,
      productionUrl: activation.productionUrl,
      artifactKey: artifact.artifactKey,
      sizeBytes: artifact.sizeBytes,
      fileCount: artifact.fileCount,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    if (err instanceof BuildCancelledError) {
      await logger.log("system", "warn", "Build aborted due to cancellation request.");
      await logger.flush();
      throw err;
    }

    const msg = err instanceof Error ? err.message : "Build worker failed";
    await logger.log("build", "error", msg);
    await logger.flush();

    await admin
      .from("deployments")
      .update({
        status: "failed",
        error_summary: msg.slice(0, 500),
        build_duration_ms: durationMs,
        finished_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    throw err;
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
