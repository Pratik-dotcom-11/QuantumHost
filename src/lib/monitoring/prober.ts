export interface HttpProbeOutcome {
  status: "up" | "degraded" | "down";
  httpStatus: number | null;
  latencyMs: number;
  errorMessage: string | null;
}

export async function runHttpProbe(targetUrl: string): Promise<HttpProbeOutcome> {
  const started = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
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
