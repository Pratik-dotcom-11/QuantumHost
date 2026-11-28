import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadArtifactDirectory } from "../src/lib/storage/artifacts";
import {
  buildDeploymentHostingUrls,
  formatUuidFromCompact,
  parseHostingHost,
} from "../src/lib/hosting/urls";
import {
  cloudflareSaasAdapter,
  quantumHostEdgeAdapter,
  resolveHostingProviderAdapter,
} from "../src/lib/deployments/hosting-adapter";
import {
  createCloudflareCustomHostname,
  getCloudflareCustomHostname,
  mapCloudflareDomainStatuses,
} from "../src/lib/hosting/cloudflare";
import { verifyDomainAndSsl } from "../src/lib/hosting/domains";

// Shared mutable fixture store for route handler integration tests
const mockState = vi.hoisted(() => ({
  publishedRoute: null as null | {
    project_id: string;
    slug: string;
    active_deployment_id: string | null;
    artifact_storage_provider: string | null;
    artifact_key: string | null;
  },
  deployments: new Map<
    string,
    {
      id: string;
      project_id: string;
      user_id: string;
      deployment_number: number;
      status: string;
      hosting_provider: string;
      artifact_storage_provider: string | null;
      artifact_key: string | null;
      preview_url: string | null;
    }
  >(),
  projects: new Map<
    string,
    {
      id: string;
      user_id: string;
      slug: string;
      active_deployment_id: string | null;
    }
  >(),
  logs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createPublicServerClient: () => ({
    from: (table: string) => {
      if (table === "published_routes") {
        return {
          select: () => ({
            eq: (_col: string, slug: string) => ({
              maybeSingle: async () => ({
                data:
                  mockState.publishedRoute && mockState.publishedRoute.slug === slug
                    ? mockState.publishedRoute
                    : null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "deployments") {
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({
              maybeSingle: async () => ({
                data: mockState.deployments.get(id) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async () => ({ error: null }),
      };
    },
  }),
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: async () => ({
    user: { id: "user-1", email: "dev@quantumhost.app" },
    supabase: {
      from: (table: string) => {
        if (table === "deployments") {
          return {
            select: () => ({
              eq: (_c: string, id: string) => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: mockState.deployments.get(id) ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    },
  }),
  requireApiUser: async () => ({
    unauthorizedResponse: null,
    user: { id: "user-1", email: "dev@quantumhost.app" },
    supabase: {
      from: (table: string) => {
        if (table === "deployments") {
          return {
            select: () => ({
              eq: (_c: string, id: string) => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: mockState.deployments.get(id) ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: (_c: string, id: string) => ({
                eq: () => ({
                  single: async () => ({
                    data: mockState.projects.get(id) ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
            update: (patch: { active_deployment_id: string }) => ({
              eq: (_c: string, id: string) => ({
                eq: () => ({
                  select: () => ({
                    single: async () => {
                      const proj = mockState.projects.get(id);
                      if (!proj) return { data: null, error: { message: "Not found" } };
                      proj.active_deployment_id = patch.active_deployment_id;
                      const dep = mockState.deployments.get(patch.active_deployment_id);
                      if (dep && dep.status === "ready") {
                        mockState.publishedRoute = {
                          project_id: proj.id,
                          slug: proj.slug,
                          active_deployment_id: dep.id,
                          artifact_storage_provider: dep.artifact_storage_provider,
                          artifact_key: dep.artifact_key,
                        };
                      }
                      return { data: proj, error: null };
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "deployment_logs") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { seq: mockState.logs.length },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: async (row: Record<string, unknown>) => {
              mockState.logs.push(row);
              return { error: null };
            },
          };
        }
        return {};
      },
    },
  }),
}));

import { GET as serveSiteGet } from "../src/app/sites/[slug]/[[...path]]/route";
import { GET as servePreviewGet } from "../src/app/d/[deploymentId]/[[...path]]/route";
import { POST as rollbackPost } from "../src/app/api/deployments/[id]/rollback/route";

describe("Phase 6 Hosting, Routing, Rollback & Domain Verification", () => {
  const tempDirs: string[] = [];
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.NEXT_PUBLIC_APP_URL = "https://quantumhost.app";
    delete process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.HOSTING_PROVIDER;
    mockState.publishedRoute = null;
    mockState.deployments.clear();
    mockState.projects.clear();
    mockState.logs = [];
  });

  afterEach(async () => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    tempDirs.length = 0;
  });

  it("generates unique deployment URLs and parses subdomain + custom domain hosts", () => {
    const depId = "11111111-2222-4333-8444-555566667777";
    const wildcardUrls = buildDeploymentHostingUrls({
      appUrl: "https://quantumhost.app",
      slug: "my-portfolio",
      deploymentId: depId,
      platformDomain: "quantumhost.app",
    });

    expect(wildcardUrls.productionUrl).toBe("https://my-portfolio.quantumhost.app");
    expect(wildcardUrls.previewUrl).toBe(
      "https://my-portfolio-d-11111111222243338444555566667777.quantumhost.app"
    );

    const parsedProd = parseHostingHost({
      hostHeader: "my-portfolio.quantumhost.app",
      appUrl: "https://quantumhost.app",
      platformDomain: "quantumhost.app",
    });
    expect(parsedProd).toEqual({ kind: "production-slug", slug: "my-portfolio" });

    const parsedPreview = parseHostingHost({
      hostHeader: "my-portfolio-d-11111111222243338444555566667777.quantumhost.app",
      appUrl: "https://quantumhost.app",
      platformDomain: "quantumhost.app",
    });
    expect(parsedPreview).toEqual({
      kind: "preview-prefix",
      slug: "my-portfolio",
      deploymentIdPrefix: "11111111222243338444555566667777",
    });
    if (parsedPreview.kind === "preview-prefix") {
      expect(formatUuidFromCompact(parsedPreview.deploymentIdPrefix)).toBe(depId);
    }

    expect(
      parseHostingHost({
        hostHeader: "demo-site.localhost:3000",
        appUrl: "http://localhost:3000",
        platformDomain: null,
      })
    ).toEqual({ kind: "production-slug", slug: "demo-site" });

    expect(
      parseHostingHost({
        hostHeader: "app.customerdomain.com",
        appUrl: "http://localhost:3000",
        platformDomain: "quantumhost.app",
      })
    ).toEqual({ kind: "custom-domain", domain: "app.customerdomain.com" });

    expect(
      parseHostingHost({
        hostHeader: "localhost:3000",
        appUrl: "http://localhost:3000",
        platformDomain: null,
      })
    ).toEqual({ kind: "control-plane" });
  });

  it("selects modular hosting provider adapters cleanly and honors Cloudflare API responses", async () => {
    expect(resolveHostingProviderAdapter().name).toBe(quantumHostEdgeAdapter.name);

    process.env.CLOUDFLARE_API_TOKEN = "cf_test_token";
    process.env.CLOUDFLARE_ZONE_ID = "zone_123";
    expect(resolveHostingProviderAdapter().name).toBe(cloudflareSaasAdapter.name);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "ch_abc123",
            hostname: "app.example.com",
            status: "pending",
            ssl: {
              status: "pending_validation",
              validation_records: [
                { txt_name: "_cf-custom-hostname.app.example.com", txt_value: "cf-dcv-token" },
              ],
            },
          },
        }),
        { status: 200 }
      )
    );

    const created = await createCloudflareCustomHostname("app.example.com", {
      project_id: "proj-1",
    });
    expect(created.id).toBe("ch_abc123");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone_123/custom_hostnames",
      expect.objectContaining({ method: "POST" })
    );

    const mappedPending = mapCloudflareDomainStatuses(created);
    expect(mappedPending.verificationStatus).toBe("pending");
    expect(mappedPending.sslStatus).toBe("provisioning");

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "ch_abc123",
            hostname: "app.example.com",
            status: "active",
            ssl: { status: "active" },
          },
        }),
        { status: 200 }
      )
    );
    const active = await getCloudflareCustomHostname("ch_abc123");
    const mappedActive = mapCloudflareDomainStatuses(active);
    expect(mappedActive.verificationStatus).toBe("verified");
    expect(mappedActive.sslStatus).toBe("active");
  });

  it("never marks SSL active without provider or live TLS + DNS routing confirmation", async () => {
    const token = "qh-verify=deadbeef1234";

    // 1. Missing TXT fails verification
    const noTxt = await verifyDomainAndSsl(
      {
        domain: "app.example.com",
        verificationToken: token,
        appUrl: "https://quantumhost.app",
        provider: "dns",
        providerHostnameId: null,
      },
      {
        resolveTxtFn: async () => [],
        resolveCnameFn: async () => [],
        resolveAFn: async () => [],
        probeHttpsFn: async () => ({
          tlsAuthorized: false,
          certSubject: null,
          validTo: null,
          httpsReachable: false,
          httpStatus: null,
          error: "No DNS",
        }),
      }
    );
    expect(noTxt.verificationStatus).toBe("failed");
    expect(noTxt.sslStatus).toBe("pending");
    expect(noTxt.httpsVerified).toBe(false);

    // 2. TXT matches, but CNAME is missing -> verified ownership, SSL stays pending (NEVER active)
    const txtOnly = await verifyDomainAndSsl(
      {
        domain: "app.example.com",
        verificationToken: token,
        appUrl: "https://quantumhost.app",
        provider: "dns",
        providerHostnameId: null,
      },
      {
        resolveTxtFn: async (h) => (h.startsWith("_quantumhost.") ? [[token]] : []),
        resolveCnameFn: async () => [],
        resolveAFn: async () => [],
        probeHttpsFn: async () => ({
          tlsAuthorized: false,
          certSubject: null,
          validTo: null,
          httpsReachable: false,
          httpStatus: null,
          error: "No CNAME",
        }),
      }
    );
    expect(txtOnly.verificationStatus).toBe("verified");
    expect(txtOnly.sslStatus).toBe("pending");
    expect(txtOnly.httpsVerified).toBe(false);

    // 3. TXT + CNAME match, TLS cert invalid/pending -> sslStatus is "provisioning"
    const provisioning = await verifyDomainAndSsl(
      {
        domain: "app.example.com",
        verificationToken: token,
        appUrl: "https://quantumhost.app",
        provider: "dns",
        providerHostnameId: null,
      },
      {
        resolveTxtFn: async () => [[token]],
        resolveCnameFn: async () => ["edge.quantumhost.app"],
        resolveAFn: async () => ["198.51.100.10"],
        probeHttpsFn: async () => ({
          tlsAuthorized: false,
          certSubject: null,
          validTo: null,
          httpsReachable: false,
          httpStatus: null,
          error: "Certificate provisioning in progress",
        }),
      }
    );
    expect(provisioning.verificationStatus).toBe("verified");
    expect(provisioning.sslStatus).toBe("provisioning");
    expect(provisioning.httpsVerified).toBe(false);

    // 4. TXT + CNAME + valid TLS & HTTPS 200 -> sslStatus "active" and httpsVerified true
    const fullHttps = await verifyDomainAndSsl(
      {
        domain: "app.example.com",
        verificationToken: token,
        appUrl: "https://quantumhost.app",
        provider: "dns",
        providerHostnameId: null,
      },
      {
        resolveTxtFn: async () => [[token]],
        resolveCnameFn: async () => ["edge.quantumhost.app"],
        resolveAFn: async () => ["198.51.100.10"],
        probeHttpsFn: async () => ({
          tlsAuthorized: true,
          certSubject: "app.example.com",
          validTo: "2027-01-01T00:00:00Z",
          httpsReachable: true,
          httpStatus: 200,
          error: null,
        }),
      }
    );
    expect(fullHttps.verificationStatus).toBe("verified");
    expect(fullHttps.sslStatus).toBe("active");
    expect(fullHttps.httpsVerified).toBe(true);
    expect(fullHttps.httpsStatusCode).toBe(200);
  });

  it("serves static assets, blocks failed previews, and performs verified atomic rollbacks", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qh-phase6-store-"));
    const v1Out = await fs.mkdtemp(path.join(os.tmpdir(), "qh-v1-"));
    const v2Out = await fs.mkdtemp(path.join(os.tmpdir(), "qh-v2-"));
    tempDirs.push(storageRoot, v1Out, v2Out);

    process.env.ARTIFACT_STORAGE_PROVIDER = "local";
    process.env.LOCAL_STORAGE_DIR = storageRoot;

    // Upload v1 release
    await fs.writeFile(path.join(v1Out, "index.html"), "<h1>Release v1</h1>", "utf8");
    await fs.mkdir(path.join(v1Out, "assets"), { recursive: true });
    await fs.writeFile(path.join(v1Out, "assets", "main.js"), "console.log('v1');", "utf8");
    const v1Artifact = await uploadArtifactDirectory("proj-1", "dep-v1", v1Out);

    // Upload v2 release
    await fs.writeFile(path.join(v2Out, "index.html"), "<h1>Release v2</h1>", "utf8");
    const v2Artifact = await uploadArtifactDirectory("proj-1", "dep-v2", v2Out);

    mockState.projects.set("proj-1", {
      id: "proj-1",
      user_id: "user-1",
      slug: "my-site",
      active_deployment_id: "dep-v2",
    });

    mockState.deployments.set("dep-v1", {
      id: "dep-v1",
      project_id: "proj-1",
      user_id: "user-1",
      deployment_number: 1,
      status: "ready",
      hosting_provider: "quantumhost-edge",
      artifact_storage_provider: v1Artifact.provider,
      artifact_key: v1Artifact.artifactKey,
      preview_url: "https://quantumhost.app/d/dep-v1",
    });

    mockState.deployments.set("dep-v2", {
      id: "dep-v2",
      project_id: "proj-1",
      user_id: "user-1",
      deployment_number: 2,
      status: "ready",
      hosting_provider: "quantumhost-edge",
      artifact_storage_provider: v2Artifact.provider,
      artifact_key: v2Artifact.artifactKey,
      preview_url: "https://quantumhost.app/d/dep-v2",
    });

    mockState.deployments.set("dep-failed", {
      id: "dep-failed",
      project_id: "proj-1",
      user_id: "user-1",
      deployment_number: 3,
      status: "failed",
      hosting_provider: "quantumhost-edge",
      artifact_storage_provider: null,
      artifact_key: null,
      preview_url: "https://quantumhost.app/d/dep-failed",
    });

    mockState.publishedRoute = {
      project_id: "proj-1",
      slug: "my-site",
      active_deployment_id: "dep-v2",
      artifact_storage_provider: v2Artifact.provider,
      artifact_key: v2Artifact.artifactKey,
    };

    // 1. Live route currently serves v2
    const liveV2 = await serveSiteGet(new Request("https://quantumhost.app/sites/my-site"), {
      params: Promise.resolve({ slug: "my-site", path: [] }),
    });
    expect(liveV2.status).toBe(200);
    expect(await liveV2.text()).toContain("Release v2");
    expect(liveV2.headers.get("X-QuantumHost-Deployment")).toBe("dep-v2");

    // 2. Preview route serves immutable v1 asset and rejects failed deployments
    const previewJs = await servePreviewGet(
      new Request("https://quantumhost.app/d/dep-v1/assets/main.js"),
      { params: Promise.resolve({ deploymentId: "dep-v1", path: ["assets", "main.js"] }) }
    );
    expect(previewJs.status).toBe(200);
    expect(previewJs.headers.get("Content-Type")).toContain("javascript");
    expect(await previewJs.text()).toContain("console.log('v1')");

    const failedPreview = await servePreviewGet(
      new Request("https://quantumhost.app/d/dep-failed"),
      { params: Promise.resolve({ deploymentId: "dep-failed", path: [] }) }
    );
    expect(failedPreview.status).toBe(404);

    // 3. Rollback API refuses failed deployments and keeps active v2 intact
    const failedRollback = await rollbackPost(
      new Request("https://quantumhost.app/api/deployments/dep-failed/rollback", { method: "POST" }),
      { params: Promise.resolve({ id: "dep-failed" }) }
    );
    expect(failedRollback.status).toBe(400);
    expect(mockState.projects.get("proj-1")?.active_deployment_id).toBe("dep-v2");

    // 4. Rollback API promotes v1 cleanly and live site immediately serves v1 + JS asset
    const rollbackOk = await rollbackPost(
      new Request("https://quantumhost.app/api/deployments/dep-v1/rollback", { method: "POST" }),
      { params: Promise.resolve({ id: "dep-v1" }) }
    );
    expect(rollbackOk.status).toBe(200);
    const rollbackBody = (await rollbackOk.json()) as {
      rolledBack: boolean;
      activeDeploymentId: string;
    };
    expect(rollbackBody.rolledBack).toBe(true);
    expect(rollbackBody.activeDeploymentId).toBe("dep-v1");

    const liveAfterRollback = await serveSiteGet(new Request("https://quantumhost.app/sites/my-site"), {
      params: Promise.resolve({ slug: "my-site", path: [] }),
    });
    expect(liveAfterRollback.status).toBe(200);
    expect(await liveAfterRollback.text()).toContain("Release v1");
    expect(liveAfterRollback.headers.get("X-QuantumHost-Deployment")).toBe("dep-v1");

    // 5. Missing slug returns 404 safely
    const missingSite = await serveSiteGet(new Request("https://quantumhost.app/sites/nonexistent"), {
      params: Promise.resolve({ slug: "nonexistent", path: [] }),
    });
    expect(missingSite.status).toBe(404);
  });
});
