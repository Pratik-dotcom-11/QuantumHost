import { getPublicEnv, getServerSupabaseServiceKey } from "@/lib/env";

export interface GitHubAuthStatus {
  configured: boolean;
  mode: "supabase" | "direct" | "unconfigured";
  supabaseConfigured: boolean;
  directConfigured: boolean;
  hasGitHubClientCredentials: boolean;
  hasServiceRoleKey: boolean;
  supabaseProjectId: string;
  supabaseCallbackUrl: string;
  directCallbackUrl: string;
  instructions: {
    supabaseDashboardUrl: string;
    githubNewAppUrl: string;
    appUrl: string;
  };
  message: string;
}

// In-memory cache for probe results keyed by origin to avoid excessive remote calls (30s TTL)
const cachedStatuses = new Map<string, { status: GitHubAuthStatus; expiresAt: number }>();

export function extractSupabaseProjectId(supabaseUrl: string): string {
  try {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;
    // e.g. "ufmfbsrthpjahrnawirg.supabase.co" -> "ufmfbsrthpjahrnawirg"
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[1] === "supabase" && parts[2] === "co") {
      return parts[0] || "unknown-project";
    }
    return parts[0] || "unknown-project";
  } catch {
    return "unknown-project";
  }
}

export function getSupabaseCallbackUrl(supabaseUrl: string): string {
  try {
    const url = new URL(supabaseUrl);
    return `${url.origin}/auth/v1/callback`;
  } catch {
    return "https://your-project.supabase.co/auth/v1/callback";
  }
}

/**
 * Checks whether Supabase GoTrue has GitHub OAuth provider enabled.
 * When GitHub provider is disabled, GoTrue responds with HTTP 400:
 * {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
 *
 * When GitHub provider is enabled, GoTrue responds with HTTP 302/303 redirect
 * to https://github.com/login/oauth/authorize?...
 */
export async function probeSupabaseGitHubProvider(
  supabaseUrl: string
): Promise<{ enabled: boolean; errorDetail?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const probeUrl = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/authorize?provider=github`;
    const response = await fetch(probeUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });

    clearTimeout(timeout);

    if (response.status === 400) {
      const text = await response.text();
      if (text.includes("Unsupported provider") || text.includes("validation_failed")) {
        return { enabled: false, errorDetail: "provider_not_enabled" };
      }
    }

    const location = response.headers.get("location");
    if (
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 200 ||
      Boolean(location && location.includes("github.com/login/oauth/authorize"))
    ) {
      return { enabled: true };
    }

    return { enabled: false, errorDetail: `status_${response.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { enabled: false, errorDetail: msg };
  }
}

export async function checkGitHubAuthStatus(
  forceFresh = false,
  requestOrigin?: string
): Promise<GitHubAuthStatus> {
  const { supabaseUrl, appUrl } = getPublicEnv();
  const effectiveAppUrl = (requestOrigin || appUrl).replace(/\/+$/, "");

  const now = Date.now();
  const cached = cachedStatuses.get(effectiveAppUrl);
  if (!forceFresh && cached && cached.expiresAt > now) {
    return cached.status;
  }

  const projectId = extractSupabaseProjectId(supabaseUrl);
  const supabaseCallbackUrl = getSupabaseCallbackUrl(supabaseUrl);
  const directCallbackUrl = `${effectiveAppUrl}/api/auth/github/callback`;

  const hasGitHubClientCredentials = Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()
  );
  const hasServiceRoleKey = Boolean(getServerSupabaseServiceKey());

  // Direct OAuth login bridge requires both GitHub OAuth App credentials and Supabase Service Role Key
  const directConfigured = hasGitHubClientCredentials && hasServiceRoleKey;

  const { enabled: supabaseConfigured } = await probeSupabaseGitHubProvider(supabaseUrl);

  const configured = supabaseConfigured || directConfigured;
  let mode: "supabase" | "direct" | "unconfigured" = "unconfigured";
  if (supabaseConfigured) {
    mode = "supabase";
  } else if (directConfigured) {
    mode = "direct";
  }

  let message = "GitHub sign-in is ready.";
  if (!configured) {
    if (hasGitHubClientCredentials && !hasServiceRoleKey) {
      message =
        "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set, but SUPABASE_SERVICE_ROLE_KEY is missing for direct login. Either add SUPABASE_SERVICE_ROLE_KEY or enable GitHub in your Supabase Dashboard.";
    } else {
      message =
        "GitHub authentication is not enabled yet in your Supabase project (HTTP 400: Unsupported provider). Enable GitHub under Authentication -> Providers in your Supabase Dashboard.";
    }
  }

  const status: GitHubAuthStatus = {
    configured,
    mode,
    supabaseConfigured,
    directConfigured,
    hasGitHubClientCredentials,
    hasServiceRoleKey,
    supabaseProjectId: projectId,
    supabaseCallbackUrl,
    directCallbackUrl,
    instructions: {
      supabaseDashboardUrl: `https://supabase.com/dashboard/project/${projectId}/auth/providers`,
      githubNewAppUrl: "https://github.com/settings/applications/new",
      appUrl: effectiveAppUrl,
    },
    message,
  };

  cachedStatuses.set(effectiveAppUrl, {
    status,
    expiresAt: now + 30000,
  });

  return status;
}

export function clearGitHubAuthStatusCache(): void {
  cachedStatuses.clear();
}
