import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { getPublicEnv } from "@/lib/env";
import { buildDeploymentHostingUrls } from "@/lib/hosting/urls";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requirePageUser();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, slug, framework, repo_full_name, repo_url, default_branch, root_directory, install_command, build_command, output_directory, node_version, auto_deploy, active_deployment_id"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const [{ data: deployments }, { data: rawEnv }, { data: projectDomains }] = await Promise.all([
    supabase
      .from("deployments")
      .select(
        "id, deployment_number, status, environment, trigger_source, git_branch, git_commit_sha, git_commit_message, artifact_size_bytes, build_duration_ms, hosting_provider, preview_url, production_url, started_at, finished_at, error_summary, verified_at, created_at"
      )
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("project_env_vars")
      .select("id, key, encrypted_value, is_secret, environment, updated_at")
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .order("key", { ascending: true }),
    supabase
      .from("custom_domains")
      .select("id, domain, verification_status, ssl_status, https_verified")
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const { appUrl } = getPublicEnv();
  const hostingUrls = buildDeploymentHostingUrls({
    appUrl,
    slug: project.slug,
    deploymentId: project.active_deployment_id ?? project.id,
  });

  const envVars = (rawEnv ?? []).map((row) => {
    let preview = "••••••";
    try {
      const plain = decryptSecret(row.encrypted_value);
      preview = row.is_secret ? maskSecret(plain) : plain;
    } catch {
      preview = "••••••";
    }
    return {
      id: row.id,
      key: row.key,
      isSecret: row.is_secret,
      environment: row.environment,
      preview,
      updatedAt: row.updated_at,
    };
  });

  return (
    <ProjectDetailClient
      initialProject={project}
      initialDeployments={deployments ?? []}
      initialEnvVars={envVars}
      initialDomains={projectDomains ?? []}
      hostingUrls={hostingUrls}
    />
  );
}
