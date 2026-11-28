import { requirePageUser } from "@/lib/auth";
import { CopilotPanel } from "@/components/ai/copilot-panel";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: projects }, { data: deployments }, { data: aiConfig }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("deployments")
      .select("id, project_id, deployment_number, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("ai_configurations")
      .select("provider, model, encrypted_api_key, is_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const serverHasKey = Boolean(process.env.AI_API_KEY?.trim());
  const configured = Boolean(aiConfig?.encrypted_api_key) || serverHasKey;
  const enabled = aiConfig ? aiConfig.is_enabled : true;
  const provider = aiConfig?.provider || process.env.AI_PROVIDER || "gemini";
  const model = aiConfig?.model || process.env.AI_MODEL || "gemini-2.5-flash";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
          Deployment Copilot
        </h1>
        <p className="mt-1 text-sm text-[#9a9084]">
          AI-powered troubleshooting assistant grounded in your real logs, configurations, failures, and usage telemetry.
        </p>
      </div>
      <CopilotPanel
        configured={configured}
        enabled={enabled}
        provider={provider}
        model={model}
        projects={projects ?? []}
        deployments={deployments ?? []}
      />
    </div>
  );
}
