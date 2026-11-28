import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { detectFrameworkFromPackageJson, type FrameworkPreset } from "@/lib/frameworks";

const GITHUB_API_BASE = "https://api.github.com";

export function isValidRepoFullName(repoFullName: string): boolean {
  if (!repoFullName || repoFullName.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repoFullName.trim());
}

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

export async function resolveConnectionToken(
  connection: {
    provider_type: string;
    installation_id: number | null;
    encrypted_access_token: string | null;
    token_expires_at?: string | null;
  },
  onRenewed?: (encryptedToken: string, expiresAt: string) => Promise<void>
): Promise<string> {
  if (connection.provider_type === "github_app" && connection.installation_id) {
    // Reuse cached installation token if valid for at least 2 more minutes
    if (connection.encrypted_access_token && connection.token_expires_at) {
      const expiresMs = Date.parse(connection.token_expires_at);
      if (Number.isFinite(expiresMs) && expiresMs - Date.now() > 120_000) {
        try {
          return decryptSecret(connection.encrypted_access_token);
        } catch {
          // Fall through and renew installation token
        }
      }
    }

    const { token, expiresAt } = await getInstallationAccessToken(connection.installation_id);
    if (onRenewed) {
      try {
        await onRenewed(encryptSecret(token), expiresAt);
      } catch {
        // Non-fatal persistence error; fresh token is still usable
      }
    }
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
  email?: string | null;
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

interface GitHubEmailRecord {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function fetchGitHubPrimaryEmail(token: string): Promise<string | null> {
  const res = await fetch(`${GITHUB_API_BASE}/user/emails`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const emails = (await res.json()) as GitHubEmailRecord[];
  const primaryVerified = emails.find((item) => item.primary && item.verified);
  if (primaryVerified) return primaryVerified.email;

  const anyVerified = emails.find((item) => item.verified);
  return anyVerified?.email ?? null;
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
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    pull?: boolean;
  };
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

export async function getRepositoryMetadata(
  token: string | null,
  repoFullName: string
): Promise<GitHubRepoSummary> {
  if (!isValidRepoFullName(repoFullName)) {
    throw new Error("Invalid repository identifier. Use owner/repository format.");
  }

  const res = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName.trim()}`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 403) {
    throw new Error(`Repository "${repoFullName}" is inaccessible or does not exist.`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to inspect repository (${res.status}): ${text}`);
  }

  return (await res.json()) as GitHubRepoSummary;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  committedAt: string | null;
}

export async function getLatestCommit(
  token: string | null,
  repoFullName: string,
  branch: string
): Promise<GitHubCommitSummary | null> {
  if (!isValidRepoFullName(repoFullName)) return null;

  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName.trim()}/commits/${encodeURIComponent(branch)}`,
    {
      headers: githubHeaders(token),
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as {
    sha?: string;
    commit?: {
      message?: string;
      author?: { name?: string; date?: string };
    };
    author?: { login?: string } | null;
  };

  if (!data.sha) return null;

  return {
    sha: data.sha,
    message: (data.commit?.message || "").split("\n")[0]?.slice(0, 200) || "Latest commit",
    authorName: data.commit?.author?.name ?? null,
    authorLogin: data.author?.login ?? null,
    committedAt: data.commit?.author?.date ?? null,
  };
}

export async function listBranches(
  token: string | null,
  repoFullName: string
): Promise<string[]> {
  if (!isValidRepoFullName(repoFullName)) return ["main"];

  const res = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName.trim()}/branches?per_page=100`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    return ["main"];
  }

  const data = (await res.json()) as Array<{ name: string }>;
  return data.map((b) => b.name);
}

export async function fetchRepoFileText(
  token: string | null,
  repoFullName: string,
  filePath: string,
  branch: string
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${repoFullName.trim()}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: githubHeaders(token),
      cache: "no-store",
    }
  );
  if (!res.ok) return null;

  const payload = (await res.json()) as { content?: string };
  if (!payload.content) return null;
  return Buffer.from(payload.content, "base64").toString("utf8");
}

export async function listRepoDirectoryFiles(
  token: string | null,
  repoFullName: string,
  branch: string,
  rootDirectory = "."
): Promise<string[]> {
  if (!isValidRepoFullName(repoFullName)) return [];
  const normalizedRoot = rootDirectory.replace(/^\.?\/+|\/+$/g, "");
  const endpoint = normalizedRoot
    ? `${GITHUB_API_BASE}/repos/${repoFullName.trim()}/contents/${normalizedRoot}?ref=${encodeURIComponent(branch)}`
    : `${GITHUB_API_BASE}/repos/${repoFullName.trim()}/contents?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(endpoint, {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return [];

  const payload = (await res.json()) as Array<{ name?: string; type?: string }> | { name?: string };
  if (!Array.isArray(payload)) return [];
  return payload.map((item) => item.name).filter((n): n is string => Boolean(n));
}

export async function fetchRepositoryIntelligenceInputs(
  token: string | null,
  repoFullName: string,
  branch: string,
  rootDirectory = "."
): Promise<{
  rootFiles: string[];
  packageJsonRaw: string | null;
  nextConfigRaw: string | null;
  viteConfigRaw: string | null;
  envExampleRaw: string | null;
}> {
  const normalizedRoot = rootDirectory.replace(/^\.?\/+|\/+$/g, "");
  const prefix = normalizedRoot ? `${normalizedRoot}/` : "";

  const rootFiles = await listRepoDirectoryFiles(token, repoFullName, branch, rootDirectory);
  const lower = new Set(rootFiles.map((f) => f.toLowerCase()));

  const nextConfFile = lower.has("next.config.ts")
    ? "next.config.ts"
    : lower.has("next.config.mjs")
    ? "next.config.mjs"
    : lower.has("next.config.js")
    ? "next.config.js"
    : null;

  const viteConfFile = lower.has("vite.config.ts")
    ? "vite.config.ts"
    : lower.has("vite.config.mjs")
    ? "vite.config.mjs"
    : lower.has("vite.config.js")
    ? "vite.config.js"
    : null;

  const envFile = lower.has(".env.example")
    ? ".env.example"
    : lower.has("env.example")
    ? "env.example"
    : null;

  const [packageJsonRaw, nextConfigRaw, viteConfigRaw, envExampleRaw] = await Promise.all([
    fetchRepoFileText(token, repoFullName, `${prefix}package.json`, branch),
    nextConfFile ? fetchRepoFileText(token, repoFullName, `${prefix}${nextConfFile}`, branch) : Promise.resolve(null),
    viteConfFile ? fetchRepoFileText(token, repoFullName, `${prefix}${viteConfFile}`, branch) : Promise.resolve(null),
    envFile ? fetchRepoFileText(token, repoFullName, `${prefix}${envFile}`, branch) : Promise.resolve(null),
  ]);

  return {
    rootFiles,
    packageJsonRaw,
    nextConfigRaw,
    viteConfigRaw,
    envExampleRaw,
  };
}

export async function inspectRepositoryFramework(
  token: string | null,
  repoFullName: string,
  branch: string,
  rootDirectory = "."
): Promise<{
  preset: FrameworkPreset;
  hasPackageJson: boolean;
  detectedPackageName: string | null;
  compatibilityNote: string | null;
}> {
  if (!isValidRepoFullName(repoFullName)) {
    throw new Error("Invalid repository identifier. Use owner/repository format.");
  }

  const normalizedRoot = rootDirectory.replace(/^\.?\/+|\/+$/g, "");
  const prefix = normalizedRoot ? `${normalizedRoot}/` : "";

  const decoded = await fetchRepoFileText(token, repoFullName, `${prefix}package.json`, branch);
  if (!decoded) {
    return {
      preset: detectFrameworkFromPackageJson(null),
      hasPackageJson: false,
      detectedPackageName: null,
      compatibilityNote: null,
    };
  }

  let detectedPackageName: string | null = null;
  try {
    const parsed = JSON.parse(decoded) as { name?: string };
    detectedPackageName = parsed.name ?? null;
  } catch {
    detectedPackageName = null;
  }

  const preset = detectFrameworkFromPackageJson(decoded);
  let compatibilityNote: string | null = null;

  if (preset.id === "nextjs") {
    const [tsConf, mjsConf, jsConf] = await Promise.all([
      fetchRepoFileText(token, repoFullName, `${prefix}next.config.ts`, branch),
      fetchRepoFileText(token, repoFullName, `${prefix}next.config.mjs`, branch),
      fetchRepoFileText(token, repoFullName, `${prefix}next.config.js`, branch),
    ]);
    const nextConfigText = tsConf || mjsConf || jsConf || "";
    const hasStaticExport = /output\s*:\s*['"]export['"]/.test(nextConfigText);
    if (!hasStaticExport) {
      compatibilityNote =
        'QuantumHost currently serves static Next.js exports ("output: \'export\'"). Server-rendered routes or middleware require static export mode.';
    }
  } else if (preset.id === "node") {
    compatibilityNote =
      "Custom Node build scripts are supported only when generating static HTML/CSS/JS output in your configured output directory.";
  }

  return {
    preset,
    hasPackageJson: true,
    detectedPackageName,
    compatibilityNote,
  };
}

export async function registerRepoWebhook(
  token: string,
  repoFullName: string,
  webhookUrl: string,
  secret: string
): Promise<{ id: number }> {
  if (!isValidRepoFullName(repoFullName)) {
    throw new Error("Invalid repository identifier.");
  }

  const res = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName.trim()}/hooks`, {
    method: "POST",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push", "pull_request"],
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
