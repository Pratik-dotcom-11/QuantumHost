import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { DeploymentDetailClient } from "@/components/deployments/deployment-detail-client";

export const dynamic = "force-dynamic";

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requirePageUser();

  const { data: deployment } = await supabase
    .from("deployments")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!deployment) {
    notFound();
  }

  const [{ data: project }, { data: logs }] = await Promise.all([
    supabase
      .from("projects")
      .select("name, slug, active_deployment_id")
      .eq("id", deployment.project_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("deployment_logs")
      .select("id, seq, level, stage, message, created_at")
      .eq("deployment_id", deployment.id)
      .eq("user_id", user.id)
      .order("seq", { ascending: true })
      .limit(500),
  ]);

  return (
    <DeploymentDetailClient
      initialDeployment={deployment as unknown as Parameters<typeof DeploymentDetailClient>[0]["initialDeployment"]}
      initialLogs={logs ?? []}
      projectName={project?.name ?? "Project"}
      projectSlug={project?.slug ?? ""}
      isCurrentProduction={project?.active_deployment_id === deployment.id}
    />
  );
}
