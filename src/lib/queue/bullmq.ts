import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getRedisUrl } from "@/lib/env";

export const BUILD_QUEUE_NAME = "quantumhost-builds";

export interface BuildJobPayload {
  deploymentId: string;
  projectId: string;
  userId: string;
  environment: "production" | "preview";
}

let cachedConnection: IORedis | null = null;
let cachedQueue: Queue<BuildJobPayload> | null = null;

export function getRedisConnection(): IORedis {
  if (!cachedConnection) {
    cachedConnection = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 3000,
    });
    cachedConnection.on("error", () => {
      // Handled gracefully at enqueue time
    });
  }
  return cachedConnection;
}

export function getBuildQueue(): Queue<BuildJobPayload> {
  if (!cachedQueue) {
    cachedQueue = new Queue<BuildJobPayload>(BUILD_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    });
  }
  return cachedQueue;
}

export async function enqueueBuildJob(payload: BuildJobPayload): Promise<string> {
  const probe = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    connectTimeout: 2500,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  probe.on("error", () => {
    // Handled below in try/catch
  });

  try {
    await probe.connect();
    await probe.ping();
    await probe.quit();
  } catch (err) {
    try {
      probe.disconnect();
    } catch {
      // ignore
    }
    const reason = err instanceof Error ? err.message : "Unable to connect to Redis";
    throw new Error(
      `Redis queue is unreachable (${reason}). Ensure Redis is running at REDIS_URL and the build worker is active.`
    );
  }

  const queue = getBuildQueue();
  const existing = await queue.getJob(payload.deploymentId);
  if (existing) {
    return existing.id ?? payload.deploymentId;
  }

  const job = await queue.add("deploy", payload, {
    jobId: payload.deploymentId,
  });
  return job.id ?? payload.deploymentId;
}

export async function cancelQueuedJob(deploymentId: string): Promise<void> {
  try {
    const queue = getBuildQueue();
    const job = await queue.getJob(deploymentId);
    if (job) {
      await job.remove();
    }
  } catch {
    // Job may already be active or Redis unreachable; DB cancelled flag handles active abort
  }
}
