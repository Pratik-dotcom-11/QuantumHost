import { lookup } from "node:dns/promises";
import net from "node:net";
export { sanitizeRelativeRedirectPath } from "./redirect";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0]! << 24) >>> 0) + ((parts[1]! << 16) >>> 0) + ((parts[2]! << 8) >>> 0) + parts[3]!;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase();
  if (net.isIPv4(cleaned)) {
    const val = ipv4ToInt(cleaned);
    if (val === null) return true;
    // 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10 (CGNAT), 127.0.0.0/8, 169.254.0.0/16 (link-local/IMDS),
    // 172.16.0.0/12, 192.0.0.0/24, 192.168.0.0/16, 198.18.0.0/15, 224.0.0.0/4+
    const a = (val >>> 24) & 0xff;
    const b = (val >>> 16) & 0xff;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
  }

  if (net.isIPv6(cleaned)) {
    if (
      cleaned === "::" ||
      cleaned === "::1" ||
      cleaned.startsWith("fe80:") ||
      cleaned.startsWith("fc") ||
      cleaned.startsWith("fd") ||
      cleaned.startsWith("ff")
    ) {
      return true;
    }
    if (cleaned.startsWith("::ffff:")) {
      return isPrivateOrReservedIp(cleaned.slice("::ffff:".length));
    }
    return false;
  }

  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
]);

export async function assertSafeOutboundHttpUrl(
  rawUrl: string,
  options: { allowLoopback?: boolean; requireHttps?: boolean; skipDnsResolution?: boolean } = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL format.");
  }

  const allowedProtocols = options.requireHttps ? ["https:"] : ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(
      options.requireHttps
        ? "Only HTTPS URLs are permitted for this configuration."
        : "Only HTTP and HTTPS URLs are permitted."
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error("Embedded URL credentials are not permitted.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) {
    throw new Error("Hostname is required.");
  }

  if (!options.allowLoopback) {
    if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
      throw new Error(`Target host "${host}" is restricted by SSRF protection.`);
    }

    if (net.isIP(host)) {
      if (isPrivateOrReservedIp(host)) {
        throw new Error(`IP address "${host}" is restricted (private/loopback/link-local).`);
      }
      return parsed;
    }

    if (!options.skipDnsResolution) {
      try {
        const resolved = await lookup(host, { all: true });
        if (resolved.length === 0) {
          throw new Error(`Hostname "${host}" did not resolve.`);
        }
        for (const entry of resolved) {
          if (isPrivateOrReservedIp(entry.address)) {
            throw new Error(
              `Hostname "${host}" resolves to a private or restricted IP (${entry.address}).`
            );
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("restricted")) {
          throw err;
        }
        throw new Error(`Unable to safely verify DNS resolution for "${host}".`);
      }
    }
  }

  return parsed;
}
