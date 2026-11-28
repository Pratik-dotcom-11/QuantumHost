import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import tls from "node:tls";
import {
  createCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  getCloudflareCustomHostname,
  isCloudflareConfigured,
  mapCloudflareDomainStatuses,
  refreshCloudflareCustomHostname,
} from "@/lib/hosting/cloudflare";
import { getCnameTargetHost } from "@/lib/hosting/urls";

export interface DnsInstructionRecord {
  [key: string]: string | undefined;
  type: string;
  name: string;
  value: string;
  purpose?: string;
}

export interface HttpsTlsProbeResult {
  tlsAuthorized: boolean;
  certSubject: string | null;
  validTo: string | null;
  httpsReachable: boolean;
  httpStatus: number | null;
  error: string | null;
}

export interface DomainVerificationOutcome {
  verificationStatus: "pending" | "verified" | "failed";
  sslStatus: "pending" | "provisioning" | "active" | "error";
  httpsVerified: boolean;
  httpsStatusCode: number | null;
  verificationError: string | null;
  provider: "dns" | "cloudflare";
  providerHostnameId: string | null;
  dnsRecords?: DnsInstructionRecord[];
  diagnostics: {
    txtMatched: boolean;
    cnameMatched: boolean;
    dnsResolves: boolean;
    observedTxt: string[];
    observedCname: string[];
    observedAddresses: string[];
    tlsAuthorized: boolean;
    httpsStatusCode: number | null;
    providerStatus: string | null;
    providerSslStatus: string | null;
  };
}

export interface DomainVerificationDeps {
  resolveTxtFn?: (hostname: string) => Promise<string[][]>;
  resolveCnameFn?: (hostname: string) => Promise<string[]>;
  resolveAFn?: (hostname: string) => Promise<string[]>;
  probeHttpsFn?: (domain: string) => Promise<HttpsTlsProbeResult>;
}

export function buildBaselineDnsRecords(params: {
  domain: string;
  verificationToken: string;
  appUrl: string;
}): DnsInstructionRecord[] {
  return [
    {
      type: "TXT",
      name: `_quantumhost.${params.domain}`,
      value: params.verificationToken,
      purpose: "Ownership verification",
    },
    {
      type: "CNAME",
      name: params.domain,
      value: getCnameTargetHost(params.appUrl),
      purpose: "Edge traffic routing",
    },
  ];
}

export async function registerDomainWithProvider(params: {
  domain: string;
  projectId: string;
  projectSlug: string;
  appUrl: string;
  verificationToken: string;
}): Promise<{
  provider: "dns" | "cloudflare";
  providerHostnameId: string | null;
  verificationStatus: "pending" | "verified" | "failed";
  sslStatus: "pending" | "provisioning" | "active" | "error";
  dnsRecords: DnsInstructionRecord[];
  verificationError: string | null;
}> {
  const dnsRecords = buildBaselineDnsRecords(params);

  if (!isCloudflareConfigured()) {
    return {
      provider: "dns",
      providerHostnameId: null,
      verificationStatus: "pending",
      sslStatus: "pending",
      dnsRecords,
      verificationError: null,
    };
  }

  try {
    const cf = await createCloudflareCustomHostname(params.domain, {
      project_id: params.projectId,
      project_slug: params.projectSlug,
    });
    const mapped = mapCloudflareDomainStatuses(cf);

    if (cf.ownership_verification?.name && cf.ownership_verification?.value) {
      dnsRecords.push({
        type: (cf.ownership_verification.type || "txt").toUpperCase(),
        name: cf.ownership_verification.name,
        value: cf.ownership_verification.value,
        purpose: "Cloudflare SaaS ownership",
      });
    }

    for (const rec of cf.ssl?.validation_records ?? []) {
      if (rec.txt_name && rec.txt_value) {
        dnsRecords.push({
          type: "TXT",
          name: rec.txt_name,
          value: rec.txt_value,
          purpose: "Cloudflare SSL DCV",
        });
      }
    }

    return {
      provider: "cloudflare",
      providerHostnameId: cf.id,
      verificationStatus: mapped.verificationStatus,
      sslStatus: mapped.sslStatus,
      dnsRecords,
      verificationError: mapped.errorSummary,
    };
  } catch (err) {
    return {
      provider: "dns",
      providerHostnameId: null,
      verificationStatus: "pending",
      sslStatus: "pending",
      dnsRecords,
      verificationError:
        err instanceof Error ? `Cloudflare registration skipped: ${err.message}` : null,
    };
  }
}

export async function removeDomainFromProvider(
  provider: string | null | undefined,
  providerHostnameId: string | null | undefined
): Promise<void> {
  if (provider === "cloudflare" && providerHostnameId && isCloudflareConfigured()) {
    await deleteCloudflareCustomHostname(providerHostnameId).catch(() => undefined);
  }
}

export async function probeHttpsAndTls(domain: string): Promise<HttpsTlsProbeResult> {
  const tlsResult = await new Promise<{
    tlsAuthorized: boolean;
    certSubject: string | null;
    validTo: string | null;
    error: string | null;
  }>((resolve) => {
    let finished = false;
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: true,
        timeout: 5000,
      },
      () => {
        if (finished) return;
        finished = true;
        const cert = socket.getPeerCertificate();
        const subject =
          typeof cert?.subject?.CN === "string"
            ? cert.subject.CN
            : Array.isArray(cert?.subject?.CN)
            ? cert.subject.CN[0] ?? null
            : null;
        const result = {
          tlsAuthorized: socket.authorized,
          certSubject: subject,
          validTo: cert?.valid_to ?? null,
          error: socket.authorized ? null : socket.authorizationError?.toString() || "TLS not trusted",
        };
        socket.end();
        resolve(result);
      }
    );

    socket.on("timeout", () => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({
        tlsAuthorized: false,
        certSubject: null,
        validTo: null,
        error: "TLS handshake timed out on port 443",
      });
    });

    socket.on("error", (err) => {
      if (finished) return;
      finished = true;
      resolve({
        tlsAuthorized: false,
        certSubject: null,
        validTo: null,
        error: err.message || "TLS connection failed",
      });
    });
  });

  if (!tlsResult.tlsAuthorized) {
    return {
      ...tlsResult,
      httpsReachable: false,
      httpStatus: null,
    };
  }

  try {
    const res = await fetch(`https://${domain}/`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "QuantumHost-DomainVerify/1.0" },
    });
    return {
      ...tlsResult,
      httpsReachable: res.status < 500,
      httpStatus: res.status,
      error: res.status >= 500 ? `HTTPS origin returned HTTP ${res.status}` : null,
    };
  } catch (err) {
    return {
      ...tlsResult,
      httpsReachable: false,
      httpStatus: null,
      error: err instanceof Error ? err.message : "HTTPS GET probe failed",
    };
  }
}

export async function verifyDomainAndSsl(
  params: {
    domain: string;
    verificationToken: string;
    appUrl: string;
    provider: string | null;
    providerHostnameId: string | null;
  },
  deps: DomainVerificationDeps = {}
): Promise<DomainVerificationOutcome> {
  const resolveTxtFn = deps.resolveTxtFn ?? resolveTxt;
  const resolveCnameFn = deps.resolveCnameFn ?? resolveCname;
  const resolveAFn = deps.resolveAFn ?? resolve4;
  const probeHttpsFn = deps.probeHttpsFn ?? probeHttpsAndTls;

  const expectedEdgeHost = getCnameTargetHost(params.appUrl);
  const txtTargets = [`_quantumhost.${params.domain}`, params.domain];

  let txtMatched = false;
  const observedTxt: string[] = [];

  for (const host of txtTargets) {
    try {
      const records = await resolveTxtFn(host);
      for (const chunks of records) {
        const flat = chunks.join("");
        observedTxt.push(`${host}: ${flat}`);
        if (flat.includes(params.verificationToken)) {
          txtMatched = true;
        }
      }
    } catch {
      // TXT record not present yet
    }
  }

  let cnameMatched = false;
  const observedCname: string[] = [];
  try {
    const cnames = await resolveCnameFn(params.domain);
    observedCname.push(...cnames);
    cnameMatched = cnames.some((c) => {
      const normalized = c.toLowerCase().replace(/\.$/, "");
      return (
        normalized === expectedEdgeHost.toLowerCase() ||
        normalized.endsWith(".quantumhost.app") ||
        normalized.includes("quantumhost")
      );
    });
  } catch {
    // No CNAME found
  }

  const observedAddresses: string[] = [];
  try {
    const addrs = await resolveAFn(params.domain);
    observedAddresses.push(...addrs);
  } catch {
    // No A records resolved
  }

  const dnsResolves = observedCname.length > 0 || observedAddresses.length > 0;

  // Check Cloudflare SaaS Custom Hostnames API when provider is active
  let providerStatus: string | null = null;
  let providerSslStatus: string | null = null;
  let providerError: string | null = null;
  let updatedDnsRecords: DnsInstructionRecord[] | undefined;

  if (params.provider === "cloudflare" && params.providerHostnameId && isCloudflareConfigured()) {
    try {
      const current = await getCloudflareCustomHostname(params.providerHostnameId);
      let latest = current;
      if (current.status !== "active" || current.ssl?.status !== "active") {
        latest = await refreshCloudflareCustomHostname(params.providerHostnameId).catch(
          () => current
        );
      }
      const mapped = mapCloudflareDomainStatuses(latest);
      providerStatus = latest.status;
      providerSslStatus = latest.ssl?.status ?? null;
      providerError = mapped.errorSummary;

      const records = buildBaselineDnsRecords({
        domain: params.domain,
        verificationToken: params.verificationToken,
        appUrl: params.appUrl,
      });
      if (latest.ownership_verification?.name && latest.ownership_verification?.value) {
        records.push({
          type: (latest.ownership_verification.type || "txt").toUpperCase(),
          name: latest.ownership_verification.name,
          value: latest.ownership_verification.value,
          purpose: "Cloudflare SaaS ownership",
        });
      }
      for (const rec of latest.ssl?.validation_records ?? []) {
        if (rec.txt_name && rec.txt_value) {
          records.push({
            type: "TXT",
            name: rec.txt_name,
            value: rec.txt_value,
            purpose: "Cloudflare SSL DCV",
          });
        }
      }
      updatedDnsRecords = records;

      const tlsProbe =
        mapped.verificationStatus === "verified" && mapped.sslStatus === "active"
          ? await probeHttpsFn(params.domain)
          : {
              tlsAuthorized: false,
              certSubject: null,
              validTo: null,
              httpsReachable: false,
              httpStatus: null,
              error: providerError || "Waiting for Cloudflare hostname activation & TLS certificate.",
            };

      return {
        verificationStatus: mapped.verificationStatus,
        sslStatus: mapped.sslStatus,
        httpsVerified: Boolean(tlsProbe.tlsAuthorized && tlsProbe.httpsReachable),
        httpsStatusCode: tlsProbe.httpStatus,
        verificationError: providerError || tlsProbe.error,
        provider: "cloudflare",
        providerHostnameId: latest.id,
        dnsRecords: updatedDnsRecords,
        diagnostics: {
          txtMatched,
          cnameMatched,
          dnsResolves,
          observedTxt,
          observedCname,
          observedAddresses,
          tlsAuthorized: tlsProbe.tlsAuthorized,
          httpsStatusCode: tlsProbe.httpStatus,
          providerStatus,
          providerSslStatus,
        },
      };
    } catch (err) {
      providerError = err instanceof Error ? err.message : "Cloudflare status lookup failed";
    }
  }

  // Standalone DNS + Real TLS/HTTPS verification (never falsely marks SSL active from TXT alone)
  if (!txtMatched) {
    return {
      verificationStatus: "failed",
      sslStatus: "pending",
      httpsVerified: false,
      httpsStatusCode: null,
      verificationError: `TXT record "${params.verificationToken}" not found at _quantumhost.${params.domain}.`,
      provider: params.provider === "cloudflare" ? "cloudflare" : "dns",
      providerHostnameId: params.providerHostnameId,
      diagnostics: {
        txtMatched: false,
        cnameMatched,
        dnsResolves,
        observedTxt,
        observedCname,
        observedAddresses,
        tlsAuthorized: false,
        httpsStatusCode: null,
        providerStatus,
        providerSslStatus,
      },
    };
  }

  // TXT ownership verified — now inspect DNS routing + live TLS handshake before reporting SSL active
  const tlsProbe = dnsResolves
    ? await probeHttpsFn(params.domain)
    : {
        tlsAuthorized: false,
        certSubject: null,
        validTo: null,
        httpsReachable: false,
        httpStatus: null,
        error: `DNS CNAME/A record for ${params.domain} does not resolve to ${expectedEdgeHost} yet.`,
      };

  const httpsVerified = Boolean(cnameMatched && tlsProbe.tlsAuthorized && tlsProbe.httpsReachable);
  const sslStatus: DomainVerificationOutcome["sslStatus"] = httpsVerified
    ? "active"
    : cnameMatched || dnsResolves
    ? "provisioning"
    : "pending";

  const verificationError = httpsVerified
    ? null
    : !cnameMatched
    ? `Ownership TXT verified, but ${params.domain} CNAME must point to ${expectedEdgeHost} before TLS can activate.`
    : tlsProbe.error || "Ownership verified; awaiting valid HTTPS TLS certificate.";

  return {
    verificationStatus: "verified",
    sslStatus,
    httpsVerified,
    httpsStatusCode: tlsProbe.httpStatus,
    verificationError,
    provider: params.provider === "cloudflare" ? "cloudflare" : "dns",
    providerHostnameId: params.providerHostnameId,
    diagnostics: {
      txtMatched,
      cnameMatched,
      dnsResolves,
      observedTxt,
      observedCname,
      observedAddresses,
      tlsAuthorized: tlsProbe.tlsAuthorized,
      httpsStatusCode: tlsProbe.httpStatus,
      providerStatus,
      providerSslStatus,
    },
  };
}
