import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { resolveHostingProviderAdapter } from "@/lib/deployments/hosting-adapter";
import { getPublicEnv } from "@/lib/env";
import { getLatestCommit, resolveConnectionToken } from "@/lib/github/client";
import { buildDeploymentHostingUrls } from "@/lib/hosting/urls";
import { enqueueBuildJob } from "@/lib/queue/bullmq";

const createDeploymentSchema = z.object({
  projectId: z.string().uuid(),
  branch: z.string().min(1).max(100).optional(),
  environment: z.enum(["production", "preview"]).default("production"),
  commitSha: z.string().max(64).optional(),
  commitMessage: z.string().max(240).optional(),
});

export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  let query = supabase
    .from("deployments")
    .select(
      "id, project_id, deployment_number, status, environment, trigger_source, git_branch, git_commit_sha, git_commit_message, git_author, artifact_storage_provider, artifact_size_bytes, preview_url, build_duration_ms, error_summary, rollback_from_deployment_id, started_at, finished_at, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deployments: data ?? [] });
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

  const parsed = createDeploymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, default_branch, repo_full_name, github_connection_id")
    .eq("id", parsed.data.projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.repo_full_name) {
    return NextResponse.json(
      { error: "Project does not have a GitHub repository configured." },
      { status: 400 }
    );
  }

  const branch = parsed.data.branch?.trim() || project.default_branch;

  let resolvedCommitSha = parsed.data.commitSha ?? null;
  let resolvedCommitMessage = parsed.data.commitMessage ?? null;
  let resolvedAuthor = user.email ?? "developer";

  if (!resolvedCommitSha) {
    try {
      let token: string | null = null;
      if (project.github_connection_id) {
        const { data: conn } = await supabase
          .from("github_connections")
          .select("id, provider_type, installation_id, encrypted_access_token, token_expires_at")
          .eq("id", project.github_connection_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (conn) {
          token = await resolveConnectionToken(conn);
        }
      }
      const commit = await getLatestCommit(token, project.repo_full_name, branch);
      if (commit) {
        resolvedCommitSha = commit.sha;
        resolvedCommitMessage = resolvedCommitMessage ?? commit.message;
        resolvedAuthor = commit.authorLogin || commit.authorName || resolvedAuthor;
      }
    } catch {
      // Fall back gracefully if commit lookup is unavailable
    }
  }

  const { data: deployment, error: insertError } = await supabase
    .from("deployments")
    .insert({
      project_id: project.id,
      user_id: user.id,
      status: "queued",
      environment: parsed.data.environment,
      trigger_source: "manual",
      git_branch: branch,
      git_commit_sha: resolvedCommitSha,
      git_commit_message: resolvedCommitMessage ?? `Manual deployment of ${branch}`,
      git_author: resolvedAuthor,
    })
    .select("id, deployment_number, status, environment, git_branch, created_at")
    .single();

  if (insertError || !deployment) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to create deployment record" },
      { status: 500 }
    );
  }

  const { appUrl } = getPublicEnv();
  const hostingUrls = buildDeploymentHostingUrls({
    appUrl,
    slug: project.slug,
    deploymentId: deployment.id,
  });
  const adapter = resolveHostingProviderAdapter();
  const previewUrl = hostingUrls.previewUrl;
  const productionUrl =
    parsed.data.environment === "production" ? hostingUrls.productionUrl : null;

  await supabase
    .from("deployments")
    .update({
      hosting_provider: adapter.name,
      preview_url: previewUrl,
      production_url: productionUrl,
    })
    .eq("id", deployment.id)
    .eq("user_id", user.id);

  await supabase.from("deployment_logs").insert({
    deployment_id: deployment.id,
    project_id: project.id,
    user_id: user.id,
    seq: 1,
    level: "system",
    stage: "queue",
    message: `Queued ${parsed.data.environment} deployment #${deployment.deployment_number} for branch "${branch}".`,
  });

  try {
    const jobId = await enqueueBuildJob({
      deploymentId: deployment.id,
      projectId: project.id,
      userId: user.id,
      environment: parsed.data.environment,
    });

    await supabase
      .from("deployments")
      .update({ job_id: jobId })
      .eq("id", deployment.id)
      .eq("user_id", user.id);

    return NextResponse.json(
      { deployment: { ...deployment, preview_url: previewUrl, job_id: jobId } },
      { status: 201 }
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to enqueue deployment job";

    await supabase
      .from("deployments")
      .update({
        status: "failed",
        error_summary: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", deployment.id)
      .eq("user_id", user.id);

    await supabase.from("deployment_logs").insert({
      deployment_id: deployment.id,
      project_id: project.id,
      user_id: user.id,
      seq: 2,
      level: "error",
      stage: "queue",
      message: errorMessage,
    });

    return NextResponse.json(
      { error: errorMessage, deploymentId: deployment.id },
      { status: 503 }
    );
  }
}
