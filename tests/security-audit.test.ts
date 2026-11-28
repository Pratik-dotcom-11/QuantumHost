import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertSafeOutboundHttpUrl,
  isPrivateOrReservedIp,
  sanitizeRelativeRedirectPath,
} from "../src/lib/security/url-safety";
import {
  checkRateLimit,
  rateLimitExceededResponse,
  resetRateLimitsForTest,
} from "../src/lib/security/rate-limit";
import { runHttpProbe } from "../src/lib/monitoring/prober";
import { sanitizeGitBranchName } from "../src/lib/worker/build-runner";

describe("Phase 8 Security Audit Verification", () => {
  beforeEach(() => {
    resetRateLimitsForTest();
  });

  afterEach(() => {
    resetRateLimitsForTest();
  });

  it("prevents Open Redirect attacks via relative redirect sanitizer", () => {
    expect(sanitizeRelativeRedirectPath("/projects/123?tab=deployments")).toBe(
      "/projects/123?tab=deployments"
    );
    expect(sanitizeRelativeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(sanitizeRelativeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeRelativeRedirectPath("https://evil.com/phish")).toBe("/dashboard");
    expect(sanitizeRelativeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeRelativeRedirectPath(null)).toBe("/dashboard");
  });

  it("blocks SSRF targets across IPv4/IPv6 private, loopback, and metadata ranges", async () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("10.10.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.4.2")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.10")).toBe(true);
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);

    await expect(
      assertSafeOutboundHttpUrl("http://169.254.169.254/latest/meta-data/", {
        skipDnsResolution: true,
      })
    ).rejects.toThrow(/restricted/i);

    await expect(
      assertSafeOutboundHttpUrl("http://localhost:6379/", { skipDnsResolution: true })
    ).rejects.toThrow(/restricted/i);

    await expect(
      assertSafeOutboundHttpUrl("http://[::1]:3000/", { skipDnsResolution: true })
    ).rejects.toThrow(/restricted/i);

    await expect(
      assertSafeOutboundHttpUrl("https://user:pass@example.com/hook", { skipDnsResolution: true })
    ).rejects.toThrow(/credentials/i);

    await expect(
      assertSafeOutboundHttpUrl("http://api.openai.com/v1", {
        requireHttps: true,
        skipDnsResolution: true,
      })
    ).rejects.toThrow(/HTTPS/i);

    // Ensure monitoring prober blocks internal metadata/loopback probes
    const probeBlocked = await runHttpProbe("http://169.254.169.254/latest/meta-data/");
    expect(probeBlocked.status).toBe("down");
    expect(probeBlocked.httpStatus).toBeNull();
    expect(probeBlocked.errorMessage).toMatch(/restricted/i);
  });

  it("enforces sliding-window API rate limits with HTTP 429 headers", async () => {
    const key = "user-1:test";
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);

    const third = checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);

    const res = rateLimitExceededResponse(third);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("rejects malicious git branch strings to prevent argument or shell injection", () => {
    expect(sanitizeGitBranchName("main")).toBe("main");
    expect(sanitizeGitBranchName("release/v1.2.3")).toBe("release/v1.2.3");
    expect(sanitizeGitBranchName("feature_phase-8")).toBe("feature_phase-8");

    expect(() => sanitizeGitBranchName('main" && calc.exe')).toThrow(/Invalid git branch/);
    expect(() => sanitizeGitBranchName("--upload-pack=evil")).toThrow(/Invalid git branch/);
    expect(() => sanitizeGitBranchName("main;rm -rf /")).toThrow(/Invalid git branch/);
    expect(() => sanitizeGitBranchName("feature/../secret")).toThrow(/Invalid git branch/);
  });
});
