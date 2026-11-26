import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { decryptSecret } from "@/lib/crypto";
import { detectFrameworkFromPackageJson, type FrameworkPreset } from "@/lib/frameworks";

const GITHUB_API_BASE = "https://api.github.com";

function githubHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "QuantumHost-ControlPlane/1.0",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function createGitHubAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();

  if (!appId || !rawPrivateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured.");
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

export async function getInstallationAccessToken(installationId: number): Promise<{
  token: string;
  expiresAt: string;
}> {
  const jwt = createGitHubAppJwt();
  const res = await fetch(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(jwt),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to mint GitHub App installation token (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { token: string; expires_at: string };
  return { token: data.token, expiresAt: data.expires_at };
}

export async function resolveConnectionToken(connection: {
  provider_type: string;
  installation_id: number | null;
  encrypted_access_token: string | null;
}): Promise<string> {
  if (connection.provider_type === "github_app" && connection.installation_id) {
    const { token } = await getInstallationAccessToken(connection.installation_id);
    return token;
  }

  if (!connection.encrypted_access_token) {
    throw new Error("GitHub connection has no stored access token.");
  }

  return decryptSecret(connection.encrypted_access_token);
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

export async function verifyGitHubToken(token: string): Promise<GitHubUserProfile> {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub authentication failed (${res.status}): ${text}`);
  }

  return (await res.json()) as GitHubUserProfile;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  description: string | null;
  language: string | null;
  updated_at: string;
}

export async function listRepositories(
  token: string,
  providerType: string
): Promise<GitHubRepoSummary[]> {
  const url =
    providerType === "github_app"
      ? `${GITHUB_API_BASE}/installation/repositories?per_page=100`
      : `${GITHUB_API_BASE}/user/repos?sort=updated&affiliation=owner,collaborator,organization_member&per_page=100`;

  const res = await fetch(url, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch GitHub repositories (${res.status}): ${text}`);
  }

  const data = (await res.json()) as GitHubRepoSummary[] | { repositories: GitHubRepoSummary[] };
  return Array.isArray(data) ? data : data.repositories;
}

export async function listBranches(
  token: string,
  repoFullName: string
): Promise<string[]> {
  const res = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName}/branches?per_page=100`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    return ["main"];
  }

  const data = (await res.json()) as Array<{ name: string }>;
  return data.map((b) => b.name);
}

export async function inspectRepositoryFramework(
  token: string,
  repoFullName: string,
  branch: string,
  rootDirectory = "."
): Promise<{
  preset: FrameworkPreset;
  hasPackageJson: boolean;
  detectedPackageName: string | null;
}> {
  const normalizedRoot = rootDirectory.replace(/^\.?\/+|\/+$/g, "");
  const pkgPath = normalizedRoot ? `${normalizedRoot}/package.json` : "package.json";

  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName}/contents/${pkgPath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: githubHeaders(token),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return {
      preset: detectFrameworkFromPackageJson(null),
      hasPackageJson: false,
      detectedPackageName: null,
    };
  }

  const payload = (await res.json()) as { content?: string; encoding?: string };
  if (!payload.content) {
    return {
      preset: detectFrameworkFromPackageJson(null),
      hasPackageJson: false,
      detectedPackageName: null,
    };
  }

  const decoded = Buffer.from(payload.content, "base64").toString("utf8");
  let detectedPackageName: string | null = null;
  try {
    const parsed = JSON.parse(decoded) as { name?: string };
    detectedPackageName = parsed.name ?? null;
  } catch {
    detectedPackageName = null;
  }

  return {
    preset: detectFrameworkFromPackageJson(decoded),
    hasPackageJson: true,
    detectedPackageName,
  };
}

export async function registerRepoWebhook(
  token: string,
  repoFullName: string,
  webhookUrl: string,
  secret: string
): Promise<{ id: number }> {
  const res = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName}/hooks`, {
    method: "POST",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
        insecure_ssl: "0",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub webhook registration failed (${res.status}): ${text}`);
  }

  const hook = (await res.json()) as { id: number };
  return { id: hook.id };
}

export function verifyGitHubWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  signatureHeader: string | null
): boolean {
  if (!secret || !signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const signatureHex = signatureHeader.slice("sha256=".length).trim();
  if (!/^[0-9a-fA-F]{64}$/.test(signatureHex)) {
    return false;
  }

  const expectedSignature = Buffer.from(signatureHex, "hex");
  const computedHmac = createHmac("sha256", secret).update(rawBody).digest();

  if (expectedSignature.length !== computedHmac.length) {
    return false;
  }

  return timingSafeEqual(expectedSignature, computedHmac);
}
