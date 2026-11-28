const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  accountId: string | null;
}

export interface CloudflareCustomHostnameSsl {
  id?: string;
  status?: string;
  method?: string;
  type?: string;
  validation_records?: Array<{
    txt_name?: string;
    txt_value?: string;
    http_url?: string;
    http_body?: string;
  }>;
  validation_errors?: Array<{ message?: string }>;
}

export interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  status: string;
  ssl?: CloudflareCustomHostnameSsl;
  ownership_verification?: {
    type?: string;
    name?: string;
    value?: string;
  };
  ownership_verification_http?: {
    http_url?: string;
    http_body?: string;
  };
  verification_errors?: string[];
}

interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

export function getCloudflareConfig(): CloudflareConfig | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  if (!apiToken || !zoneId) return null;

  return {
    apiToken,
    zoneId,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || null,
  };
}

export function isCloudflareConfigured(): boolean {
  return getCloudflareConfig() !== null;
}

async function cloudflareRequest<T>(
  cfg: CloudflareConfig,
  endpointPath: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${CLOUDFLARE_API_BASE}${endpointPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });

  const payload = (await res.json().catch(() => null)) as CloudflareEnvelope<T> | null;
  if (!res.ok || !payload?.success) {
    const errorMsg =
      payload?.errors?.map((e) => e.message).join("; ") ||
      `Cloudflare API returned HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return payload.result;
}

/**
 * Registers a customer custom hostname with Cloudflare for SaaS (`/zones/{zone_id}/custom_hostnames`).
 */
export async function createCloudflareCustomHostname(
  hostname: string,
  metadata?: Record<string, string>
): Promise<CloudflareCustomHostnameResult> {
  const cfg = getCloudflareConfig();
  if (!cfg) {
    throw new Error("Cloudflare credentials are not configured.");
  }

  return cloudflareRequest<CloudflareCustomHostnameResult>(
    cfg,
    `/zones/${encodeURIComponent(cfg.zoneId)}/custom_hostnames`,
    {
      method: "POST",
      body: JSON.stringify({
        hostname,
        ssl: {
          method: "txt",
          type: "dv",
          wildcard: false,
        },
        ...(metadata ? { custom_metadata: metadata } : {}),
      }),
    }
  );
}

/**
 * Fetches live custom hostname ownership & SSL provisioning status from Cloudflare for SaaS.
 */
export async function getCloudflareCustomHostname(
  customHostnameId: string
): Promise<CloudflareCustomHostnameResult> {
  const cfg = getCloudflareConfig();
  if (!cfg) {
    throw new Error("Cloudflare credentials are not configured.");
  }

  return cloudflareRequest<CloudflareCustomHostnameResult>(
    cfg,
    `/zones/${encodeURIComponent(cfg.zoneId)}/custom_hostnames/${encodeURIComponent(customHostnameId)}`,
    { method: "GET" }
  );
}

/**
 * Re-triggers DCV/SSL validation for a stalled Cloudflare custom hostname.
 */
export async function refreshCloudflareCustomHostname(
  customHostnameId: string
): Promise<CloudflareCustomHostnameResult> {
  const cfg = getCloudflareConfig();
  if (!cfg) {
    throw new Error("Cloudflare credentials are not configured.");
  }

  return cloudflareRequest<CloudflareCustomHostnameResult>(
    cfg,
    `/zones/${encodeURIComponent(cfg.zoneId)}/custom_hostnames/${encodeURIComponent(customHostnameId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ssl: {
          method: "txt",
          type: "dv",
        },
      }),
    }
  );
}

/**
 * Removes a custom hostname and its provisioned SSL certificate from Cloudflare for SaaS.
 */
export async function deleteCloudflareCustomHostname(customHostnameId: string): Promise<void> {
  const cfg = getCloudflareConfig();
  if (!cfg) return;

  await cloudflareRequest<{ id: string }>(
    cfg,
    `/zones/${encodeURIComponent(cfg.zoneId)}/custom_hostnames/${encodeURIComponent(customHostnameId)}`,
    { method: "DELETE" }
  );
}

export function mapCloudflareDomainStatuses(result: CloudflareCustomHostnameResult): {
  verificationStatus: "pending" | "verified" | "failed";
  sslStatus: "pending" | "provisioning" | "active" | "error";
  errorSummary: string | null;
} {
  const cfStatus = result.status.toLowerCase();
  const cfSslStatus = (result.ssl?.status || "initializing").toLowerCase();

  const verificationStatus: "pending" | "verified" | "failed" =
    cfStatus === "active"
      ? "verified"
      : result.verification_errors && result.verification_errors.length > 0
      ? "failed"
      : "pending";

  let sslStatus: "pending" | "provisioning" | "active" | "error" = "pending";
  if (cfSslStatus === "active") {
    sslStatus = "active";
  } else if (
    cfSslStatus === "initializing" ||
    cfSslStatus === "pending_validation" ||
    cfSslStatus === "pending_issuance" ||
    cfSslStatus === "pending_deployment"
  ) {
    sslStatus = "provisioning";
  } else if (
    cfSslStatus === "validation_timed_out" ||
    cfSslStatus === "expired" ||
    cfSslStatus === "deleted" ||
    cfSslStatus === "holding_deployment"
  ) {
    sslStatus = "error";
  }

  const cfErrors = [
    ...(result.verification_errors ?? []),
    ...(result.ssl?.validation_errors?.map((v) => v.message).filter(Boolean) as string[] ?? []),
  ];

  return {
    verificationStatus,
    sslStatus,
    errorSummary: cfErrors.length > 0 ? cfErrors.join("; ") : null,
  };
}
