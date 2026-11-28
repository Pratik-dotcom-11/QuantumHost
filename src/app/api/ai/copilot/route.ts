import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { askDeploymentCopilot } from "@/lib/ai/provider";
import { buildUsageSummary } from "@/lib/usage/summary";
import type { AiProviderType, Json } from "@/types/database";

const copilotSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  projectId: z.string().uuid().optional().nullable(),
  deploymentId: z.string().uuid().optional().nullable(),
});

async function resolveUserAiSettings(
  supabase: Awaited<ReturnType<typeof requireApiUser>>["supabase"],
  userId: string
): Promise<{
  configured: boolean;
  enabled: boolean;
  provider: AiProviderType;
  model: string;
  baseUrl: string | null;
  apiKey: string;
}> {
  const { data: aiConfig } = await supabase
    .from("ai_configurations")
    .select("provider, model, base_url, encrypted_api_key, is_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  const enabled = aiConfig ? aiConfig.is_enabled : true;
  const provider = (aiConfig?.provider || process.env.AI_PROVIDER || "gemini") as AiProviderType;
  const model = aiConfig?.model || process.env.AI_MODEL || "gemini-2.5-flash";
  const baseUrl = aiConfig?.base_url || process.env.AI_BASE_URL || null;

  let apiKey = process.env.AI_API_KEY?.trim() || "";
  if (aiConfig?.encrypted_api_key) {
    try {
      apiKey = decryptSecret(aiConfig.encrypted_api_key);
    } catch {
      apiKey = "";
    }
  }

  return {
    configured: Boolean(apiKey),
    enabled,
    provider,
    model,
    baseUrl,
    apiKey,
  };
}

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const settings = await resolveUserAiSettings(supabase, user.id);
  return NextResponse.json({
    configured: settings.configured,
    enabled: settings.enabled,
    provider: settings.provider,
    model: settings.model,
  });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = copilotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a question (at least 3 characters).", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const settings = await resolveUserAiSettings(supabase, user.id);
  if (!settings.enabled) {
    return NextResponse.json(
      { configured: settings.configured, enabled: false, error: "AI Copilot is disabled in Account Settings." },
      { status: 400 }
    );
  }

  if (!settings.configured) {
    return NextResponse.json(
      {
        configured: false,
        enabled: settings.enabled,
        error:
          "No AI API key is configured. Add a Gemini, OpenAI, or Anthropic key in Settings -> AI Provider to activate Deployment Copilot.",
      },
      { status: 400 }
    );
  }

  // Load real backend project/deployment/usage context scoped to this user
  let targetProjectId = parsed.data.projectId ?? null;
  let deploymentContext: Parameters<typeof askDeploymentCopilot>[1]["deployment"] = null;

  if (parsed.data.deploymentId) {
    const [{ data: dep }, { data: logs }] = await Promise.all([
      supabase
        .from("deployments")
        .select(
          "id, project_id, deployment_number, status, environment, git_branch, error_summary, build_duration_ms, artifact_size_bytes"
        )
        .eq("id", parsed.data.deploymentId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("deployment_logs")
        .select("stage, level, message")
        .eq("deployment_id", parsed.data.deploymentId)
        .eq("user_id", user.id)
        .order("seq", { ascending: true })
        .limit(120),
    ]);

    if (!dep) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    targetProjectId = dep.project_id;
    deploymentContext = {
      id: dep.id,
      deploymentNumber: dep.deployment_number,
      status: dep.status,
      environment: dep.environment,
      branch: dep.git_branch,
      errorSummary: dep.error_summary,
      buildDurationMs: dep.build_duration_ms,
      artifactSizeBytes: dep.artifact_size_bytes,
      logLines: logs ?? [],
    };
  }

  const [projectRes, projectsRes, deploymentsRes, eventsRes] = await Promise.all([
    targetProjectId
      ? supabase
          .from("projects")
          .select(
            "id, name, slug, framework, install_command, build_command, output_directory, node_version"
          )
          .eq("id", targetProjectId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("projects").select("id, name, slug").eq("user_id", user.id),
    supabase
      .from("deployments")
      .select("id, project_id, status, artifact_size_bytes, build_duration_ms")
      .eq("user_id", user.id),
    supabase
      .from("resource_usage_events")
      .select("project_id, metric_type, value")
      .eq("user_id", user.id)
      .limit(1000),
  ]);

  const usage = buildUsageSummary({
    projects: projectsRes.data ?? [],
    deployments: deploymentsRes.data ?? [],
    events: eventsRes.data ?? [],
    hostingProvider: process.env.HOSTING_PROVIDER?.trim() || "quantumhost-edge",
    storageProvider: process.env.ARTIFACT_STORAGE_PROVIDER?.trim() || "local",
  });

  try {
    const response = await askDeploymentCopilot(
      {
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
      },
      {
        question: parsed.data.question,
        project: projectRes.data
          ? {
              name: projectRes.data.name,
              slug: projectRes.data.slug,
              framework: projectRes.data.framework,
              installCommand: projectRes.data.install_command,
              buildCommand: projectRes.data.build_command,
              outputDirectory: projectRes.data.output_directory,
              nodeVersion: projectRes.data.node_version,
            }
          : null,
        deployment: deploymentContext,
        usageSummary: {
          buildMinutes: usage.totals.buildMinutes,
          storageBytes: usage.totals.currentStoredBytes || usage.totals.storageBytes,
          bandwidthBytes: usage.totals.bandwidthBytes,
          httpRequests: usage.totals.httpRequests,
          deploymentCount: usage.deploymentCounts.total,
          readyDeployments: usage.deploymentCounts.ready,
          failedDeployments: usage.deploymentCounts.failed,
          aiTokens: usage.totals.aiTokens,
        },
      }
    );

    if (deploymentContext && targetProjectId) {
      await supabase.from("ai_analyses").insert({
        deployment_id: deploymentContext.id,
        project_id: targetProjectId,
        user_id: user.id,
        analysis_type: "copilot_qa",
        summary: parsed.data.question.slice(0, 240),
        findings: response as unknown as Json,
      });
    }

    if (response.tokensUsed > 0) {
      await supabase.from("resource_usage_events").insert({
        user_id: user.id,
        project_id: targetProjectId,
        deployment_id: deploymentContext?.id ?? null,
        metric_type: "ai_tokens",
        value: response.tokensUsed,
        metadata: { provider: response.provider, model: response.model, surface: "copilot" },
      });
    }

    return NextResponse.json({ response });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deployment Copilot request failed" },
      { status: 502 }
    );
  }
}
