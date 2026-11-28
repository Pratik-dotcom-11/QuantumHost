import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { runBuildDiagnosis } from "@/lib/ai/provider";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import type { AiProviderType, Json } from "@/types/database";

const diagnoseSchema = z.object({
  deploymentId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const rl = checkRateLimit(`ai-diagnose:${user.id}`, 10, 60_000);
  if (!rl.allowed) return rateLimitExceededResponse(rl);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = diagnoseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid deploymentId is required" }, { status: 400 });
  }

  const [{ data: deployment }, { data: aiConfig }] = await Promise.all([
    supabase
      .from("deployments")
      .select("id, project_id, error_summary")
      .eq("id", parsed.data.deploymentId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("ai_configurations")
      .select("provider, model, base_url, encrypted_api_key, is_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (aiConfig && !aiConfig.is_enabled) {
    return NextResponse.json(
      { error: "AI diagnostics are disabled in your settings." },
      { status: 400 }
    );
  }

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

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No AI API key is configured. Add your Gemini, OpenAI, or Anthropic API key in Settings -> AI Provider.",
      },
      { status: 400 }
    );
  }

  const [{ data: project }, { data: logs }] = await Promise.all([
    supabase
      .from("projects")
      .select("name, framework, install_command, build_command, output_directory, node_version")
      .eq("id", deployment.project_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("deployment_logs")
      .select("stage, level, message")
      .eq("deployment_id", deployment.id)
      .eq("user_id", user.id)
      .order("seq", { ascending: true })
      .limit(120),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const diagnosis = await runBuildDiagnosis(
      { provider, model, apiKey, baseUrl },
      {
        projectName: project.name,
        framework: project.framework,
        installCommand: project.install_command,
        buildCommand: project.build_command,
        outputDirectory: project.output_directory,
        nodeVersion: project.node_version,
        errorSummary: deployment.error_summary,
        logLines: logs ?? [],
      }
    );

    await Promise.all([
      supabase
        .from("deployments")
        .update({ ai_diagnosis: diagnosis as unknown as Json })
        .eq("id", deployment.id)
        .eq("user_id", user.id),
      supabase.from("ai_analyses").insert({
        deployment_id: deployment.id,
        project_id: deployment.project_id,
        user_id: user.id,
        analysis_type: "build_failure",
        summary: diagnosis.summary,
        findings: diagnosis as unknown as Json,
      }),
    ]);

    if (diagnosis.tokensUsed > 0) {
      await supabase.from("resource_usage_events").insert({
        user_id: user.id,
        project_id: deployment.project_id,
        deployment_id: deployment.id,
        metric_type: "ai_tokens",
        value: diagnosis.tokensUsed,
        metadata: { provider: diagnosis.provider, model: diagnosis.model },
      });
    }

    return NextResponse.json({ diagnosis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI diagnosis failed" },
      { status: 502 }
    );
  }
}
