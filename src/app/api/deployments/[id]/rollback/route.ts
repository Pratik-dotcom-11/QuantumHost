import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data: target, error: targetError } = await supabase
    .from("deployments")
    .select("id, project_id, deployment_number, status, artifact_key, artifact_storage_provider")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (target.status !== "ready" || !target.artifact_key || !target.artifact_storage_provider) {
    return NextResponse.json(
      { error: "Only ready deployments with stored build artifacts can be rolled back to." },
      { status: 400 }
    );
  }

  // Atomically switch the project's active_deployment_id to this immutable artifact
  const { data: updatedProject, error: updateError } = await supabase
    .from("projects")
    .update({ active_deployment_id: target.id })
    .eq("id", target.project_id)
    .eq("user_id", user.id)
    .select("id, slug, active_deployment_id")
    .single();

  if (updateError || !updatedProject) {
    return NextResponse.json(
      { error: updateError?.message || "Failed to update active deployment" },
      { status: 500 }
    );
  }

  // Append an audit entry to deployment_logs
  const { data: lastLog } = await supabase
    .from("deployment_logs")
    .select("seq")
    .eq("deployment_id", target.id)
    .eq("user_id", user.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("deployment_logs").insert({
    deployment_id: target.id,
    project_id: target.project_id,
    user_id: user.id,
    seq: (lastLog?.seq ?? 0) + 1,
    level: "system",
    stage: "deploy",
    message: `Rollback promoted deployment #${target.deployment_number} to active production route /sites/${updatedProject.slug}.`,
  });

  return NextResponse.json({
    rolledBack: true,
    activeDeploymentId: updatedProject.active_deployment_id,
    slug: updatedProject.slug,
  });
}
