import fsSync from "node:fs";
import path from "node:path";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { BUILD_QUEUE_NAME, type BuildJobPayload } from "../src/lib/queue/bullmq";
import {
  BuildCancelledError,
  DeterministicBuildError,
  executeDeploymentLifecycle,
} from "../src/lib/worker/build-runner";

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

async function processDeploymentJob(job: Job<BuildJobPayload>) {
  try {
    await executeDeploymentLifecycle(job.data);
  } catch (err) {
    if (err instanceof BuildCancelledError || err instanceof DeterministicBuildError) {
      throw new UnrecoverableError(err.message);
    }
    throw err;
  }
}

function startWorker() {
  const redisUrl = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
  const concurrency = Number.parseInt(process.env.WORKER_CONCURRENCY || "2", 10) || 2;
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker<BuildJobPayload>(BUILD_QUEUE_NAME, processDeploymentJob, {
    connection,
    concurrency,
  });

  worker.on("ready", () => {
    console.log(
      `[QuantumHost Worker] Listening on queue "${BUILD_QUEUE_NAME}" (concurrency=${concurrency})`
    );
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
