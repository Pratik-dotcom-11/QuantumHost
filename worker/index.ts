import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { decryptSecret } from "../src/lib/crypto";
import { resolveConnectionToken } from "../src/lib/github/client";
import { BUILD_QUEUE_NAME, type BuildJobPayload } from "../src/lib/queue/bullmq";
import { uploadArtifactDirectory } from "../src/lib/storage/artifacts";
import { createAdminClient } from "../src/lib/supabase/admin";

function loadLocalEnvFile(filePath: string) {
  if (!fsSync.existsSync(filePath)) return;
  const content = fsSync.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadLocalEnvFile(path.resolve(process.cwd(), ".env"));
loadLocalEnvFile(path.resolve(process.cwd(), ".env.local"));

const BUILD_TIMEOUT_MS = Number.parseInt(process.env.BUILD_TIMEOUT_MS || "180000", 10);
const MAX_OUTPUT_BYTES = Number.parseInt(process.env.BUILD_MAX_OUTPUT_BYTES || "52428800", 10);
const USE_DOCKER_ISOLATION = process.env.DOCKER_ISOLATION === "true";

function resolveSafeSubdir(baseDir: string, relativeDir: string): string {
  const cleaned = relativeDir.trim() || ".";
  const resolved = path.resolve(baseDir, cleaned);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    throw new Error(`Invalid directory path "${relativeDir}" escapes workspace.`);
  }
  return resolved;
}

class LogWriter {
  private seq = 10;
  private readonly admin = createAdminClient();

  constructor(
    private readonly deploymentId: string,
    private readonly projectId: string,
    private readonly userId: string
  ) {}

  async log(
    stage: "queue" | "clone" | "install" | "build" | "upload" | "deploy" | "system",
    level: "info" | "warn" | "error" | "debug" | "system",
    message: string
  ) {
    const trimmed = message.trimEnd();
    if (!trimmed) return;
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
  }
}

async function runIsolatedCommand(params: {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  onLine: (line: string, isError: boolean) => Promise<void>;
  redactTokens?: string[];
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

  await new Promise<void>((resolve, reject) => {
    const child = spawn(params.command, [], {
      cwd: params.cwd,
      shell: true,
      env: params.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"]);
      } else {
        child.kill("SIGKILL");
      }
    }, params.timeoutMs);

    const pendingLogs: Promise<void>[] = [];
    const handleChunk = (chunk: Buffer, isError: boolean) => {
      const lines = sanitize(chunk.toString("utf8")).split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) {
          pendingLogs.push(params.onLine(line, isError));
        }
      }
    };

    child.stdout?.on("data", (d: Buffer) => handleChunk(d, false));
    child.stderr?.on("data", (d: Buffer) => handleChunk(d, true));

    child.on("error", async (err) => {
      clearTimeout(timer);
      await Promise.allSettled(pendingLogs);
      reject(err);
    });

    child.on("close", async (code) => {
      clearTimeout(timer);
      await Promise.allSettled(pendingLogs);
      if (timedOut) {
        reject(new Error(`Build step timed out after ${params.timeoutMs}ms`));
      } else if (code !== 0) {
        reject(new Error(`Command exited with status code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function processDeploymentJob(job: Job<BuildJobPayload>) {
  const { deploymentId, projectId, userId, environment } = job.data;
  const admin = createAdminClient();
  const logger = new LogWriter(deploymentId, projectId, userId);
  const startedAt = Date.now();
  const workspaceDir = path.join(os.tmpdir(), "qh-builds", deploymentId);
  const redactTokens: string[] = [];

  try {
    await admin
      .from("deployments")
      .update({ status: "building", started_at: new Date().toISOString() })
      .eq("id", deploymentId);

    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectErr || !project) {
      throw new Error("Project configuration not found.");
    }

    const { data: dep } = await admin
      .from("deployments")
      .select("git_branch, status")
      .eq("id", deploymentId)
      .single();

    if (dep?.status === "cancelled") {
      await logger.log("system", "warn", "Deployment was cancelled before build started.");
      return;
    }

    const branch = dep?.git_branch || project.default_branch;

    // Fetch GitHub token if connected
    let gitCloneUrl = project.repo_url || `https://github.com/${project.repo_full_name}.git`;
    if (project.github_connection_id) {
      const { data: conn } = await admin
        .from("github_connections")
        .select("provider_type, installation_id, encrypted_access_token")
        .eq("id", project.github_connection_id)
        .maybeSingle();

      if (conn) {
        const token = await resolveConnectionToken(conn);
        redactTokens.push(token);
        gitCloneUrl = `https://x-access-token:${token}@github.com/${project.repo_full_name}.git`;
      }
    }

    await fs.mkdir(workspaceDir, { recursive: true });
    await logger.log("clone", "info", `Cloning ${project.repo_full_name} (${branch}) into isolated workspace...`);

    const minimalSysEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH || "",
      HOME: os.homedir(),
      TEMP: os.tmpdir(),
      TMP: os.tmpdir(),
      SystemRoot: process.env.SystemRoot || "C:\\Windows",
      NODE_ENV: "production",
      CI: "true",
    };

    await runIsolatedCommand({
      command: `git clone --depth 1 --branch "${branch}" "${gitCloneUrl}" repo`,
      cwd: workspaceDir,
      env: minimalSysEnv,
      timeoutMs: 60_000,
      redactTokens,
      onLine: (line, isErr) => logger.log("clone", isErr ? "warn" : "info", line),
    });

    const repoDir = path.join(workspaceDir, "repo");
    const workDir = resolveSafeSubdir(repoDir, project.root_directory);

    // Load project environment variables (decrypted) for the build child process ONLY
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
        await logger.log("system", "warn", `Could not decrypt env var ${row.key}; skipping.`);
      }
    }

    // Install step
    if (project.install_command.trim()) {
      await logger.log("install", "info", `Running install command: ${project.install_command}`);
      const installCmd = USE_DOCKER_ISOLATION
        ? `docker run --rm -v "${workDir}:/app" -w /app node:${project.node_version}-alpine sh -c "${project.install_command}"`
        : project.install_command;

      await runIsolatedCommand({
        command: installCmd,
        cwd: workDir,
        env: buildEnv,
        timeoutMs: BUILD_TIMEOUT_MS,
        redactTokens,
        onLine: (line, isErr) => logger.log("install", isErr ? "warn" : "info", line),
      });
    }

    // Build step
    if (project.build_command.trim()) {
      await logger.log("build", "info", `Running build command: ${project.build_command}`);
      const buildCmd = USE_DOCKER_ISOLATION
        ? `docker run --rm --memory=1g --cpus=1 -v "${workDir}:/app" -w /app node:${project.node_version}-alpine sh -c "${project.build_command}"`
        : project.build_command;

      await runIsolatedCommand({
        command: buildCmd,
        cwd: workDir,
        env: buildEnv,
        timeoutMs: BUILD_TIMEOUT_MS,
        redactTokens,
        onLine: (line, isErr) => logger.log("build", isErr ? "warn" : "info", line),
      });
    }

    // Artifact upload
    await admin.from("deployments").update({ status: "uploading" }).eq("id", deploymentId);
    const outDir = resolveSafeSubdir(workDir, project.output_directory);
    await logger.log("upload", "info", `Uploading artifacts from "${project.output_directory}"...`);

    const artifact = await uploadArtifactDirectory(
      projectId,
      deploymentId,
      outDir,
      MAX_OUTPUT_BYTES
    );

    const buildDurationMs = Date.now() - startedAt;

    await admin
      .from("deployments")
      .update({
        status: "ready",
        artifact_storage_provider: artifact.provider,
        artifact_key: artifact.artifactKey,
        artifact_size_bytes: artifact.sizeBytes,
        build_duration_ms: buildDurationMs,
        finished_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);

    if (environment === "production") {
      await admin
        .from("projects")
        .update({ active_deployment_id: deploymentId })
        .eq("id", projectId);
    }

    await admin.from("resource_usage_events").insert([
      {
        user_id: userId,
        project_id: projectId,
        deployment_id: deploymentId,
        metric_type: "build_seconds",
        value: Number((buildDurationMs / 1000).toFixed(2)),
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
      `Deployment ready in ${(buildDurationMs / 1000).toFixed(2)}s (${artifact.fileCount} files, ${artifact.sizeBytes} bytes via ${artifact.provider}).`
    );
  } catch (err) {
    const duration = Date.now() - startedAt;
    const msg = err instanceof Error ? err.message : "Build worker failed";
    await logger.log("build", "error", msg);
    await admin
      .from("deployments")
      .update({
        status: "failed",
        error_summary: msg.slice(0, 500),
        build_duration_ms: duration,
        finished_at: new Date().toISOString(),
      })
      .eq("id", deploymentId);
    throw err;
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function startWorker() {
  const redisUrl = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker<BuildJobPayload>(BUILD_QUEUE_NAME, processDeploymentJob, {
    connection,
    concurrency: 2,
  });

  worker.on("ready", () => {
    console.log(`[QuantumHost Worker] Listening on queue "${BUILD_QUEUE_NAME}" (${redisUrl})`);
  });

  worker.on("completed", (job) => {
    console.log(`[QuantumHost Worker] Completed deployment job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[QuantumHost Worker] Failed deployment job ${job?.id}: ${err.message}`);
  });

  const shutdown = async () => {
    console.log("[QuantumHost Worker] Shutting down gracefully...");
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker();
