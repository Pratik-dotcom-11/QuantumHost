function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getPublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelPreviewUrl = process.env.VERCEL_URL?.trim();

  let appUrl = configuredAppUrl || "http://localhost:3000";
  // On Vercel, avoid falling back to localhost when NEXT_PUBLIC_APP_URL was left unset or local
  if ((!configuredAppUrl || isLocalhostUrl(configuredAppUrl)) && (vercelProdUrl || vercelPreviewUrl)) {
    appUrl = `https://${vercelProdUrl || vercelPreviewUrl}`;
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables."
    );
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    appUrl: appUrl.replace(/\/+$/, ""),
  };
}

/**
 * Resolves the canonical public origin for an incoming API request, preferring
 * forwarded proxy headers over localhost defaults in multi-environment deploys.
 */
export function resolveRequestAppUrl(request?: Request): string {
  const { appUrl } = getPublicEnv();
  if (!request) return appUrl;

  if (!isLocalhostUrl(appUrl)) {
    return appUrl;
  }

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
    }
    const url = new URL(request.url);
    if (url.origin && url.origin !== "null") {
      return url.origin.replace(/\/+$/, "");
    }
  } catch {
    // Fall back to getPublicEnv().appUrl
  }

  return appUrl;
}

export function getServerSupabaseServiceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
}

export function isEncryptionKeyConfigured(): boolean {
  const raw = process.env.ENCRYPTION_MASTER_KEY?.trim();
  return Boolean(raw && raw.length >= 16);
}
