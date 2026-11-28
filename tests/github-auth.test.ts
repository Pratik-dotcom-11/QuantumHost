import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkGitHubAuthStatus,
  clearGitHubAuthStatusCache,
  extractSupabaseProjectId,
  getSupabaseCallbackUrl,
  probeSupabaseGitHubProvider,
} from "../src/lib/auth/github-provider";

describe("GitHub Authentication Provider Resolution", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearGitHubAuthStatusCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ufmfbsrthpjahrnawirg.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    clearGitHubAuthStatusCache();
    vi.restoreAllMocks();
  });

  it("extracts project ref and computes exact Supabase OAuth callback URL", () => {
    expect(extractSupabaseProjectId("https://ufmfbsrthpjahrnawirg.supabase.co")).toBe(
      "ufmfbsrthpjahrnawirg"
    );
    expect(getSupabaseCallbackUrl("https://ufmfbsrthpjahrnawirg.supabase.co")).toBe(
      "https://ufmfbsrthpjahrnawirg.supabase.co/auth/v1/callback"
    );
  });

  it("detects disabled Supabase GitHub provider (HTTP 400 validation_failed)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 400,
          error_code: "validation_failed",
          msg: "Unsupported provider: provider is not enabled",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    const probe = await probeSupabaseGitHubProvider("https://ufmfbsrthpjahrnawirg.supabase.co");
    expect(probe.enabled).toBe(false);
    expect(probe.errorDetail).toBe("provider_not_enabled");

    const status = await checkGitHubAuthStatus(true, "https://quantumhost.vercel.app");
    expect(status.configured).toBe(false);
    expect(status.mode).toBe("unconfigured");
    expect(status.supabaseProjectId).toBe("ufmfbsrthpjahrnawirg");
    expect(status.supabaseCallbackUrl).toBe(
      "https://ufmfbsrthpjahrnawirg.supabase.co/auth/v1/callback"
    );
    expect(status.directCallbackUrl).toBe(
      "https://quantumhost.vercel.app/api/auth/github/callback"
    );
  });

  it("detects enabled Supabase GitHub provider when GoTrue returns 302 redirect", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: "https://github.com/login/oauth/authorize?client_id=abc",
        },
      })
    );

    const probe = await probeSupabaseGitHubProvider("https://ufmfbsrthpjahrnawirg.supabase.co");
    expect(probe.enabled).toBe(true);

    const status = await checkGitHubAuthStatus(true);
    expect(status.configured).toBe(true);
    expect(status.mode).toBe("supabase");
    expect(status.supabaseConfigured).toBe(true);
  });

  it("activates direct OAuth bridge only when GitHub credentials and Supabase service key are present", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 400,
          error_code: "validation_failed",
          msg: "Unsupported provider: provider is not enabled",
        }),
        { status: 400 }
      )
    );

    process.env.GITHUB_CLIENT_ID = "Iv1.testclient";
    process.env.GITHUB_CLIENT_SECRET = "secret123";

    // Without SUPABASE_SERVICE_ROLE_KEY, direct login cannot mint Supabase sessions
    const partialStatus = await checkGitHubAuthStatus(true);
    expect(partialStatus.configured).toBe(false);
    expect(partialStatus.hasGitHubClientCredentials).toBe(true);
    expect(partialStatus.hasServiceRoleKey).toBe(false);

    // With SUPABASE_SERVICE_ROLE_KEY, direct OAuth mode activates
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
    const readyStatus = await checkGitHubAuthStatus(true);
    expect(readyStatus.configured).toBe(true);
    expect(readyStatus.mode).toBe("direct");
    expect(readyStatus.directConfigured).toBe(true);
  });
});
