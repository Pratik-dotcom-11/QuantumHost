import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { resolveHostingProviderAdapter } from "@/lib/deployments/hosting-adapter";
import { getPublicEnv } from "@/lib/env";
import { buildDeploymentHostingUrls } from "@/lib/hosting/urls";
import { readArtifactAsset } from "@/lib/storage/artifacts";
import type { StorageProviderType } from "@/types/database";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data: target, error: targetError } = await supabase
    .from("deployments")
    .select(
      "id, project_id, deployment_number, status, hosting_provider, artifact_key, artifact_storage_provider, preview_url"
    )
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

  // Verify the immutable artifact entry point still reads cleanly before cutting traffic over
  const verifiedEntry = await readArtifactAsset(
    target.artifact_storage_provider as StorageProviderType,
    target.artifact_key,
    undefined
  );

  if (!verifiedEntry || verifiedEntry.bytes.byteLength === 0) {
    return NextResponse.json(
      { error: "Target deployment artifact is missing or unreadable in object storage." },
      { status: 409 }
    );
  }

  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, slug, active_deployment_id")
    .eq("id", target.project_id)
    .eq("user_id", user.id)
    .single();

  if (projError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Atomically switch the project's active_deployment_id via user-scoped RLS client
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

  const { appUrl } = getPublicEnv();
  const urls = buildDeploymentHostingUrls({
    appUrl,
    slug: updatedProject.slug,
    deploymentId: target.id,
  });

  const adapter = resolveHostingProviderAdapter(target.hosting_provider);

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
    message: `Rollback via ${adapter.name} promoted deployment #${target.deployment_number} to ${urls.productionUrl}.`,
  });

  return NextResponse.json({
    rolledBack: true,
    activeDeploymentId: updatedProject.active_deployment_id,
    slug: updatedProject.slug,
    productionUrl: urls.productionUrl,
    previewUrl: target.preview_url ?? urls.previewUrl,
  });
}
