import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDeployReadiness, extractEnvKeysFromExample } from "../src/lib/intelligence/deploy-analyzer";
import { runHttpProbe } from "../src/lib/monitoring/prober";
import { buildUsageSummary } from "../src/lib/usage/summary";
import { askDeploymentCopilot } from "../src/lib/ai/provider";

const TEST_DEP_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PROJ_ID = "22222222-2222-4222-8222-222222222222";

const copilotMockState = vi.hoisted(() => ({
  aiConfig: null as null | {
    provider: string;
    model: string;
    base_url: string | null;
    encrypted_api_key: string | null;
    is_enabled: boolean;
  },
  deployments: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      project_id: "22222222-2222-4222-8222-222222222222",
      deployment_number: 4,
      status: "failed",
      environment: "production",
      git_branch: "main",
      error_summary: "vite: command not found",
      build_duration_ms: 4200,
      artifact_size_bytes: 0,
    },
  ],
  logs: [{ stage: "build", level: "error", message: "sh: vite: command not found" }],
  events: [
    { project_id: "22222222-2222-4222-8222-222222222222", metric_type: "build_seconds", value: 4.2 },
    { project_id: "22222222-2222-4222-8222-222222222222", metric_type: "storage_bytes", value: 12000 },
  ],
  analysesInserted: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: async () => ({
    unauthorizedResponse: null,
    user: { id: "user-1", email: "dev@quantumhost.app" },
    supabase: {
      from: (table: string) => {
        if (table === "ai_configurations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: copilotMockState.aiConfig, error: null }),
              }),
            }),
          };
        }
        if (table === "deployments") {
          return {
            select: () => ({
              eq: (_c: string, val: string) => {
                if (val === TEST_DEP_ID) {
                  return {
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: copilotMockState.deployments[0],
                        error: null,
                      }),
                    }),
                  };
                }
                return Promise.resolve({ data: copilotMockState.deployments, error: null });
              },
            }),
          };
        }
        if (table === "deployment_logs") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: async () => ({ data: copilotMockState.logs, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: (_c: string, val: string) => {
                if (val === TEST_PROJ_ID) {
                  return {
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: TEST_PROJ_ID,
                          name: "Vite Site",
                          slug: "vite-site",
                          framework: "vite",
                          install_command: "npm ci",
                          build_command: "npm run build",
                          output_directory: "dist",
                          node_version: "20",
                        },
                        error: null,
                      }),
                    }),
                  };
                }
                return Promise.resolve({
                  data: [{ id: TEST_PROJ_ID, name: "Vite Site", slug: "vite-site" }],
                  error: null,
                });
              },
            }),
          };
        }
        if (table === "resource_usage_events") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({ data: copilotMockState.events, error: null }),
              }),
            }),
            insert: async () => ({ error: null }),
          };
        }
        if (table === "ai_analyses") {
          return {
            insert: async (row: Record<string, unknown>) => {
              copilotMockState.analysesInserted.push(row);
              return { error: null };
            },
          };
        }
        return {};
      },
    },
  }),
}));

import { GET as copilotStatusGet, POST as copilotAskPost } from "../src/app/api/ai/copilot/route";

describe("Phase 7 Five Core Product Features", () => {
  const servers: http.Server[] = [];
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    copilotMockState.aiConfig = null;
    copilotMockState.analysesInserted = [];
  });

  afterEach(async () => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
    await Promise.all(
      servers.map(
        (srv) =>
          new Promise<void>((resolve) => {
            srv.close(() => resolve());
          })
      )
    );
    servers.length = 0;
  });

  it("Feature 1 (Deploy Intelligence): analyzes framework, configs, commands, env vars, and readiness", () => {
    const envKeys = extractEnvKeysFromExample(`
      # Public site key
      NEXT_PUBLIC_API_URL=https://api.example.com
      VITE_ANALYTICS_ID=123
    `);
    expect(envKeys).toEqual(["NEXT_PUBLIC_API_URL", "VITE_ANALYTICS_ID"]);

    // 1. Clean Vite workspace -> READY
    const cleanVite = analyzeDeployReadiness({
      framework: "vite",
      installCommand: "npm ci",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      nodeVersion: "20",
      rootFiles: ["package.json", "package-lock.json", "index.html", "vite.config.ts", ".env.example"],
      packageJsonRaw: JSON.stringify({
        name: "my-vite-app",
        scripts: { build: "vite build" },
        devDependencies: { vite: "^6.0.0" },
      }),
      viteConfigRaw: "export default {};",
      envExampleRaw: "VITE_APP_NAME=demo\n",
      configuredEnvKeys: ["VITE_APP_NAME"],
    });
    expect(cleanVite.readiness).toBe("ready");
    expect(cleanVite.detectedFramework).toBe("vite");
    expect(cleanVite.findings.some((f) => f.severity === "blocker")).toBe(false);
    expect(cleanVite.disclaimer).toContain("cannot predict all runtime");

    // 2. Next.js repo missing static export (`output: 'export'`), missing build script, missing env var -> BLOCKED
    const brokenNext = analyzeDeployReadiness({
      framework: "nextjs",
      installCommand: "npm ci",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      nodeVersion: "20",
      rootFiles: ["package.json", "next.config.ts", ".env.example"],
      packageJsonRaw: JSON.stringify({
        name: "ssr-app",
        dependencies: { next: "16.0.0" },
        scripts: {},
      }),
      nextConfigRaw: "export default { images: { unoptimized: true } };",
      envExampleRaw: "API_SECRET=xyz\n",
      configuredEnvKeys: [],
    });
    expect(brokenNext.readiness).toBe("blocked");
    expect(brokenNext.findings.some((f) => f.id === "nextjs-ssr-not-exported")).toBe(true);
    expect(brokenNext.findings.some((f) => f.id === "missing-build-script")).toBe(true);
    expect(brokenNext.findings.some((f) => f.id === "missing-env-vars")).toBe(true);
    expect(brokenNext.requiredEnvVars).toEqual([
      { key: "API_SECRET", source: ".env.example", configured: false },
    ]);
  });

  it("Feature 3 (Live Health Monitor): executes real HTTP checks against live endpoints", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/ok") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("healthy");
      } else {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("bad gateway");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    servers.push(server);

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Failed to bind test HTTP server");

    const okProbe = await runHttpProbe(`http://127.0.0.1:${addr.port}/ok`);
    expect(okProbe.status).toBe("up");
    expect(okProbe.httpStatus).toBe(200);
    expect(okProbe.latencyMs).toBeGreaterThanOrEqual(0);
    expect(okProbe.errorMessage).toBeNull();

    const failProbe = await runHttpProbe(`http://127.0.0.1:${addr.port}/fail`);
    expect(failProbe.status).toBe("down");
    expect(failProbe.httpStatus).toBe(502);
    expect(failProbe.errorMessage).toBe("HTTP 502");
  });

  it("Feature 4 (Resource Transparency): aggregates real telemetry without fabricating numbers", () => {
    const summary = buildUsageSummary({
      projects: [{ id: "p1", name: "Alpha", slug: "alpha" }],
      deployments: [
        { id: "d1", project_id: "p1", status: "ready", artifact_size_bytes: 2048, build_duration_ms: 90_000 },
        { id: "d2", project_id: "p1", status: "failed", artifact_size_bytes: 0, build_duration_ms: 15_000 },
      ],
      events: [
        { project_id: "p1", metric_type: "build_seconds", value: 90 },
        { project_id: "p1", metric_type: "build_seconds", value: 15 },
        { project_id: "p1", metric_type: "storage_bytes", value: 2048 },
        { project_id: null, metric_type: "ai_tokens", value: 420 },
      ],
      hostingProvider: "cloudflare-saas",
      storageProvider: "s3",
    });

    expect(summary.totals.buildSeconds).toBe(105);
    expect(summary.totals.buildMinutes).toBe(1.75);
    expect(summary.totals.currentStoredBytes).toBe(2048);
    expect(summary.totals.bandwidthBytes).toBe(0);
    expect(summary.totals.httpRequests).toBe(0);
    expect(summary.totals.aiTokens).toBe(420);
    expect(summary.deploymentCounts).toEqual({ total: 2, ready: 1, failed: 1, other: 0 });
    expect(summary.measurementNotes.bandwidth).toContain("not synthesized");
    expect(summary.measurementNotes.storage).toContain("s3");
  });

  it("Feature 5 (Deployment Copilot): enforces configured credentials and uses real telemetry server-side", async () => {
    // 1. Unconfigured AI returns configured:false and refuses to fabricate AI output
    const unconfiguredStatus = await copilotStatusGet();
    const unconfiguredStatusJson = (await unconfiguredStatus.json()) as { configured: boolean };
    expect(unconfiguredStatusJson.configured).toBe(false);

    const blockedAsk = await copilotAskPost(
      new Request("http://localhost:3000/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Why did this deployment fail?",
          deploymentId: TEST_DEP_ID,
        }),
      })
    );
    expect(blockedAsk.status).toBe(400);
    const blockedBody = (await blockedAsk.json()) as { configured: boolean; error: string };
    expect(blockedBody.configured).toBe(false);
    expect(blockedBody.error).toContain("No AI API key is configured");

    // 2. When server-side AI key is configured, sends real logs + telemetry and never claims auto-execution
    process.env.AI_API_KEY = "test-server-secret-key";
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_MODEL = "gemini-2.5-flash";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      answer: "The build failed because `vite` was missing in devDependencies or skipped during install.",
                      keyFindings: ["Build log line: sh: vite: command not found"],
                      recommendedActions: ["Ensure `vite` is listed in package.json dependencies or devDependencies."],
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 185 },
        }),
        { status: 200 }
      )
    );

    const okRes = await copilotAskPost(
      new Request("http://localhost:3000/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Explain this build error",
          deploymentId: TEST_DEP_ID,
        }),
      })
    );
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as {
      response: {
        answer: string;
        tokensUsed: number;
        authorizationNotice: string;
        keyFindings: string[];
      };
    };
    expect(okJson.response.answer).toContain("vite");
    expect(okJson.response.tokensUsed).toBe(185);
    expect(okJson.response.authorizationNotice).toContain("never modifies files");
    expect(copilotMockState.analysesInserted.length).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Direct provider helper check with OpenAI-compatible path
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: "Storage usage matches 12 KB from recorded builds.",
                  keyFindings: ["buildMinutes: 0.07m"],
                  recommendedActions: ["Review unused historical artifacts."],
                }),
              },
            },
          ],
          usage: { total_tokens: 95 },
        }),
        { status: 200 }
      )
    );
    const directRes = await askDeploymentCopilot(
      { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
      { question: "Explain usage" }
    );
    expect(directRes.provider).toBe("openai");
    expect(directRes.tokensUsed).toBe(95);
  });
});
