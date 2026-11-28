import { NextResponse } from "next/server";

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, entry] of buckets) {
      if (entry.timestamps.every((t) => t <= windowStart)) {
        buckets.delete(k);
      }
    }
  }

  const existing = buckets.get(key) ?? { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((ts) => ts > windowStart);

  if (existing.timestamps.length >= limit) {
    const oldest = existing.timestamps[0] ?? now;
    const resetMs = Math.max(1000, oldest + windowMs - now);
    buckets.set(key, existing);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAtSeconds: Math.ceil(resetMs / 1000),
    };
  }

  existing.timestamps.push(now);
  buckets.set(key, existing);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.timestamps.length),
    resetAtSeconds: Math.ceil(windowMs / 1000),
  };
}

export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: `Rate limit exceeded. Try again in ${result.resetAtSeconds}s.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.resetAtSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

export function resetRateLimitsForTest(): void {
  buckets.clear();
}
