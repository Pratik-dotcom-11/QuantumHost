import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { getPublicEnv, getServerSupabaseServiceKey } from "@/lib/env";
import { verifyGitHubWebhookSignature } from "@/lib/github/client";
import { enqueueBuildJob } from "@/lib/queue/bullmq";
import { createAdminClient } from "@/lib/supabase/admin";

interface PushPayload {
  ref?: string;
  after?: string;
  repository?: {
    full_name?: string;
  };
  head_commit?: {
    id?: string;
    message?: string;
    author?: {
      name?: string;
      username?: string;
    };
  };
  pusher?: {
    name?: string;
  };
}

export async function POST(request: Request) {
  const event = request.headers.get("x-github-event");
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  if (event === "ping") {
    const globalSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (globalSecret && !verifyGitHubWebhookSignature(globalSecret, rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, event: "ping" });
  }

  if (event !== "push") {
    return NextResponse.json({ ignored: true, event }, { status: 202 });
  }

  if (!getServerSupabaseServiceKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required to process incoming webhooks." },
      { status: 503 }
    );
  }

  let payload: PushPayload;
  try {
    payload = JSON.parse(rawBody) as PushPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const repoFullName = payload.repository?.full_name;
  const pushedBranch = payload.ref?.replace(/^refs\/heads\//, "") || "";
  if (!repoFullName || !pushedBranch) {
    return NextResponse.json({ ignored: true, reason: "Missing repository or branch ref" }, { status: 202 });
  }

  const admin = createAdminClient();
  const { data: projects, error } = await admin
    .from("projects")
    .select("id, user_id, slug, default_branch, auto_deploy, webhook_secret_encrypted")
    .eq("repo_full_name", repoFullName);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ ignored: true, reason: "No matching QuantumHost project" }, { status: 202 });
  }

  const globalSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim() || "";
  const { appUrl } = getPublicEnv();
  const triggered: string[] = [];

  for (const project of projects) {
    let projectSecret = globalSecret;
    if (project.webhook_secret_encrypted) {
      try {
        projectSecret = decryptSecret(project.webhook_secret_encrypted);
      } catch {
        projectSecret = globalSecret;
      }
    }

    if (!verifyGitHubWebhookSignature(projectSecret, rawBody, signature)) {
      if (!globalSecret || !verifyGitHubWebhookSignature(globalSecret, rawBody, signature)) {
        return NextResponse.json({ error: "Invalid X-Hub-Signature-256" }, { status: 401 });
      }
    }

    if (!project.auto_deploy) continue;

    const isDefaultBranch = pushedBranch === project.default_branch;
    const environment = isDefaultBranch ? "production" : "preview";

    const { data: deployment, error: depErr } = await admin
      .from("deployments")
      .insert({
        project_id: project.id,
        user_id: project.user_id,
        status: "queued",
        environment,
        trigger_source: "git_push",
        git_branch: pushedBranch,
        git_commit_sha: payload.head_commit?.id || payload.after || null,
        git_commit_message: payload.head_commit?.message?.slice(0, 200) || null,
        git_author:
          payload.head_commit?.author?.username ||
          payload.head_commit?.author?.name ||
          payload.pusher?.name ||
          null,
      })
      .select("id")
      .single();

    if (depErr || !deployment) continue;

    await admin
      .from("deployments")
      .update({ preview_url: `${appUrl}/d/${deployment.id}` })
      .eq("id", deployment.id);

    try {
      const jobId = await enqueueBuildJob({
        deploymentId: deployment.id,
        projectId: project.id,
        userId: project.user_id,
        environment,
      });
      await admin
        .from("deployments")
        .update({ job_id: jobId })
        .eq("id", deployment.id);
      triggered.push(deployment.id);
    } catch (queueErr) {
      const msg = queueErr instanceof Error ? queueErr.message : "Failed to enqueue build";
      await admin
        .from("deployments")
        .update({ status: "failed", error_summary: msg, finished_at: new Date().toISOString() })
        .eq("id", deployment.id);
      await admin.from("deployment_logs").insert({
        deployment_id: deployment.id,
        project_id: project.id,
        user_id: project.user_id,
        seq: 1,
        level: "error",
        stage: "queue",
        message: msg,
      });
    }
  }

  return NextResponse.json({ ok: true, triggered }, { status: 202 });
}
