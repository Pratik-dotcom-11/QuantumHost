import { getPublicEnv } from "@/lib/env";
import { assertSafeOutboundHttpUrl } from "@/lib/security/url-safety";

export interface HttpProbeOutcome {
  status: "up" | "degraded" | "down";
  httpStatus: number | null;
  latencyMs: number;
  errorMessage: string | null;
}

function isSameOriginAsControlPlane(targetUrl: string): boolean {
  try {
    const appOrigin = new URL(getPublicEnv().appUrl).origin;
    return new URL(targetUrl).origin === appOrigin;
  } catch {
    return false;
  }
}

export async function runHttpProbe(
  targetUrl: string,
  options: { allowLoopback?: boolean } = {}
): Promise<HttpProbeOutcome> {
  const started = Date.now();
  try {
    const allowSameAppOrigin = isSameOriginAsControlPlane(targetUrl);
    await assertSafeOutboundHttpUrl(targetUrl, {
      allowLoopback: options.allowLoopback || allowSameAppOrigin,
      skipDnsResolution: options.allowLoopback || allowSameAppOrigin,
    });

    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "QuantumHost-UptimeProbe/1.0",
      },
      cache: "no-store",
    });

    const latencyMs = Date.now() - started;
    if (res.status >= 200 && res.status < 400) {
      return {
        status: latencyMs > 2500 ? "degraded" : "up",
        httpStatus: res.status,
        latencyMs,
        errorMessage: null,
      };
    }

    return {
      status: res.status >= 500 ? "down" : "degraded",
      httpStatus: res.status,
      latencyMs,
      errorMessage: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : "Probe request failed",
    };
  }
}
