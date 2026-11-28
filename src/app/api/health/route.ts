import { NextResponse } from "next/server";
import IORedis from "ioredis";
import { createPublicServerClient } from "@/lib/supabase/admin";
import { getRedisUrl, getServerSupabaseServiceKey, isEncryptionKeyConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

async function checkSupabase() {
  const start = Date.now();
  try {
    const supabase = createPublicServerClient();
    const { error } = await supabase
      .from("published_routes")
      .select("project_id", { count: "exact", head: true });
    if (error) {
      return { ok: false, latencyMs: Date.now() - start, error: error.message };
    }
    return {
      ok: true,
      latencyMs: Date.now() - start,
      serviceRoleConfigured: Boolean(getServerSupabaseServiceKey()),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Supabase probe failed",
    };
  }
}

async function checkRedis() {
  const start = Date.now();
  const client = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  client.on("error", () => {
    // Handled in try/catch during connect/ping
  });

  try {
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return { ok: pong === "PONG", latencyMs: Date.now() - start };
  } catch (err) {
    try {
      client.disconnect();
    } catch {
      // ignore disconnect errors
    }
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Redis unreachable",
    };
  }
}

export async function GET() {
  const [supabase, redis] = await Promise.all([checkSupabase(), checkRedis()]);
  const storageProvider = process.env.ARTIFACT_STORAGE_PROVIDER?.trim() || "local";
  const aiProvider = process.env.AI_PROVIDER?.trim() || "gemini";
  const aiConfigured = Boolean(process.env.AI_API_KEY?.trim());

  const overallOk = supabase.ok;

  return NextResponse.json(
    {
      status: overallOk ? (redis.ok ? "healthy" : "degraded") : "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        supabase,
        redis,
        storage: {
          provider: storageProvider,
          s3Configured: Boolean(
            process.env.S3_ENDPOINT &&
              process.env.S3_BUCKET &&
              process.env.S3_ACCESS_KEY_ID &&
              process.env.S3_SECRET_ACCESS_KEY
          ),
        },
        ai: {
          provider: aiProvider,
          defaultKeyConfigured: aiConfigured,
        },
        encryption: {
          configured: isEncryptionKeyConfigured(),
        },
        githubOAuth: {
          directCredentialsConfigured: Boolean(
            process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()
          ),
        },
      },
    },
    { status: overallOk ? 200 : 503 }
  );
}
