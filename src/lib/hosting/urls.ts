export interface ProjectHostingUrls {
  previewUrl: string;
  productionUrl: string;
  fallbackPreviewUrl: string;
  fallbackProductionUrl: string;
  canonicalDomainUrl: string;
  platformDomain: string | null;
  wildcardSubdomainsEnabled: boolean;
}

export type ParsedHostingHost =
  | { kind: "control-plane" }
  | { kind: "production-slug"; slug: string }
  | { kind: "preview-prefix"; slug: string; deploymentIdPrefix: string }
  | { kind: "custom-domain"; domain: string };

const PREVIEW_HOST_REGEX = /^([a-z0-9-]+)-d-([a-f0-9]{8,32})$/i;

export function getPlatformDomain(): string | null {
  const configured = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim().toLowerCase();
  if (!configured) return null;
  return configured.replace(/^\.+|\.+$/g, "");
}

export function buildDeploymentHostingUrls(params: {
  appUrl: string;
  slug: string;
  deploymentId: string;
  platformDomain?: string | null;
}): ProjectHostingUrls {
  const baseAppUrl = params.appUrl.replace(/\/+$/, "");
  const platformDomain = params.platformDomain !== undefined ? params.platformDomain : getPlatformDomain();
  const compactId = params.deploymentId.replace(/-/g, "").toLowerCase();
  const shortSlug = params.slug.slice(0, 28).replace(/-+$/, "") || "site";

  const fallbackPreviewUrl = `${baseAppUrl}/d/${params.deploymentId}`;
  const fallbackProductionUrl = `${baseAppUrl}/sites/${params.slug}`;
  const canonicalDomainUrl = `https://${params.slug}.${platformDomain || "quantumhost.app"}`;

  if (platformDomain) {
    return {
      previewUrl: `https://${shortSlug}-d-${compactId}.${platformDomain}`,
      productionUrl: `https://${params.slug}.${platformDomain}`,
      fallbackPreviewUrl,
      fallbackProductionUrl,
      canonicalDomainUrl,
      platformDomain,
      wildcardSubdomainsEnabled: true,
    };
  }

  return {
    previewUrl: fallbackPreviewUrl,
    productionUrl: fallbackProductionUrl,
    fallbackPreviewUrl,
    fallbackProductionUrl,
    canonicalDomainUrl,
    platformDomain: null,
    wildcardSubdomainsEnabled: false,
  };
}

export function formatUuidFromCompact(compactHex: string): string | null {
  const clean = compactHex.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(clean)) return null;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export function getCnameTargetHost(appUrl: string): string {
  const platformDomain = getPlatformDomain();
  if (platformDomain) return `edge.${platformDomain}`;
  const fallbackOrigin = process.env.CLOUDFLARE_CUSTOM_ORIGIN_DOMAIN?.trim().toLowerCase();
  if (fallbackOrigin) return fallbackOrigin;
  try {
    const parsed = new URL(appUrl).hostname.toLowerCase();
    if (parsed !== "localhost" && parsed !== "127.0.0.1") {
      return parsed;
    }
  } catch {
    // Ignore malformed URL
  }
  return "edge.quantumhost.app";
}

function stripPort(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const endBracket = trimmed.indexOf("]");
    return endBracket !== -1 ? trimmed.slice(0, endBracket + 1) : trimmed;
  }
  const colonIdx = trimmed.indexOf(":");
  return colonIdx === -1 ? trimmed : trimmed.slice(0, colonIdx);
}

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.startsWith("[") && host.endsWith("]")) return true;
  return false;
}

export function parseHostingHost(params: {
  hostHeader: string | null;
  appUrl?: string;
  platformDomain?: string | null;
}): ParsedHostingHost {
  if (!params.hostHeader) return { kind: "control-plane" };
  const host = stripPort(params.hostHeader);
  if (!host || host === "localhost" || isIpLiteral(host)) {
    return { kind: "control-plane" };
  }

  let appHostname: string | null = null;
  if (params.appUrl) {
    try {
      appHostname = new URL(params.appUrl).hostname.toLowerCase();
    } catch {
      appHostname = null;
    }
  }

  const platformDomain = params.platformDomain !== undefined ? params.platformDomain : getPlatformDomain();
  if (appHostname && host === appHostname) {
    return { kind: "control-plane" };
  }

  // Local multi-tenant subdomain routing (`<slug>.localhost:3000` or `<slug>-d-<prefix>.localhost:3000`)
  if (host.endsWith(".localhost")) {
    const label = host.slice(0, -".localhost".length);
    if (!label || label.includes(".")) return { kind: "control-plane" };
    const previewMatch = label.match(PREVIEW_HOST_REGEX);
    if (previewMatch) {
      return {
        kind: "preview-prefix",
        slug: previewMatch[1]!,
        deploymentIdPrefix: previewMatch[2]!.toLowerCase(),
      };
    }
    return { kind: "production-slug", slug: label };
  }

  // Platform wildcard domain routing (`*.quantumhost.app` or configured domain)
  const suffixDomain = platformDomain || "quantumhost.app";
  if (host === suffixDomain || host === `www.${suffixDomain}`) {
    return { kind: "control-plane" };
  }
  if (host.endsWith(`.${suffixDomain}`)) {
    const label = host.slice(0, -(suffixDomain.length + 1));
    if (!label || label.includes(".")) return { kind: "control-plane" };
    if (label === "edge" || label === "cname" || label === "api") {
      return { kind: "control-plane" };
    }
    const previewMatch = label.match(PREVIEW_HOST_REGEX);
    if (previewMatch) {
      return {
        kind: "preview-prefix",
        slug: previewMatch[1]!,
        deploymentIdPrefix: previewMatch[2]!.toLowerCase(),
      };
    }
    return { kind: "production-slug", slug: label };
  }

  // Treat Vercel deployment preview hostnames without subdomain prefix as control plane
  if (host.endsWith(".vercel.app") && (!appHostname || host === appHostname)) {
    return { kind: "control-plane" };
  }

  return { kind: "custom-domain", domain: host };
}
