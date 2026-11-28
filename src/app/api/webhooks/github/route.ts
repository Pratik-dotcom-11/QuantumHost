import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { resolveHostingProviderAdapter } from "@/lib/deployments/hosting-adapter";
import { getPublicEnv, getServerSupabaseServiceKey } from "@/lib/env";
import { verifyGitHubWebhookSignature } from "@/lib/github/client";
import { evaluateGitHubWebhookEvent } from "@/lib/github/webhook";
import { buildDeploymentHostingUrls } from "@/lib/hosting/urls";
import { enqueueBuildJob } from "@/lib/queue/bullmq";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery")?.trim() || null;
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  const globalSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim() || "";

  if (event === "ping") {
    if (globalSecret && !verifyGitHubWebhookSignature(globalSecret, rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, event: "ping" });
  }

  if (!getServerSupabaseServiceKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required to process incoming webhooks." },
      { status: 503 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Handle GitHub App installation removal/suspension (verified via global app webhook secret)
  if (event === "installation") {
    if (!globalSecret || !verifyGitHubWebhookSignature(globalSecret, rawBody, signature)) {
      return NextResponse.json({ error: "Invalid X-Hub-Signature-256" }, { status: 401 });
    }

    const decision = evaluateGitHubWebhookEvent(event, payload as never);
    if (decision.action === "installation_revoke" && decision.installationId) {
      if (deliveryId) {
        const { error: dupErr } = await admin
          .from("github_webhook_deliveries")
          .insert({
            delivery_id: deliveryId,
            event_type: event,
            repository_full_name: null,
          });
        if (dupErr?.code === "23505") {
          return NextResponse.json({ ok: true, duplicate: true });
        }
      }

      await admin
        .from("github_connections")
        .delete()
        .eq("installation_id", decision.installationId);

      return NextResponse.json({
        ok: true,
        event: "installation",
        revokedInstallationId: decision.installationId,
      });
    }

    return NextResponse.json({ ignored: true, reason: decision.reason }, { status: 202 });
  }

  if (event !== "push" && event !== "pull_request") {
    return NextResponse.json({ ignored: true, event }, { status: 202 });
  }

  const quickEval = evaluateGitHubWebhookEvent(event, payload as never);
  if (quickEval.action !== "deploy" || !quickEval.repoFullName) {
    return NextResponse.json({ ignored: true, reason: quickEval.reason }, { status: 202 });
  }

  const { data: projects, error } = await admin
    .from("projects")
    .select("id, user_id, slug, default_branch, auto_deploy, webhook_secret_encrypted")
    .eq("repo_full_name", quickEval.repoFullName);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ ignored: true, reason: "No matching QuantumHost project" }, { status: 202 });
  }

  // Verify X-Hub-Signature-256 against matching project secret or global app secret BEFORE deduplication
  const verifiedProjects = projects.filter((project) => {
    let projectSecret = globalSecret;
    if (project.webhook_secret_encrypted) {
      try {
        projectSecret = decryptSecret(project.webhook_secret_encrypted);
      } catch {
        projectSecret = globalSecret;
      }
    }
    return (
      (projectSecret && verifyGitHubWebhookSignature(projectSecret, rawBody, signature)) ||
      (globalSecret && verifyGitHubWebhookSignature(globalSecret, rawBody, signature))
    );
  });

  if (verifiedProjects.length === 0) {
    return NextResponse.json({ error: "Invalid X-Hub-Signature-256" }, { status: 401 });
  }

  // Record delivery ID to guarantee idempotent processing across webhook retries
  if (deliveryId) {
    const { error: dedupError } = await admin.from("github_webhook_deliveries").insert({
      delivery_id: deliveryId,
      event_type: event,
      repository_full_name: quickEval.repoFullName,
    });
    if (dedupError?.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const { appUrl } = getPublicEnv();
  const triggered: string[] = [];

  for (const project of verifiedProjects) {
    if (!project.auto_deploy) continue;

    const decision = evaluateGitHubWebhookEvent(event, payload as never, project.default_branch);
    if (decision.action !== "deploy" || !decision.branch || !decision.environment) {
      continue;
    }

    const { data: deployment, error: depErr } = await admin
      .from("deployments")
      .insert({
        project_id: project.id,
        user_id: project.user_id,
        status: "queued",
        environment: decision.environment,
        trigger_source: "git_push",
        git_branch: decision.branch,
        git_commit_sha: decision.commitSha ?? null,
        git_commit_message: decision.commitMessage ?? null,
        git_author: decision.author ?? null,
      })
      .select("id")
      .single();

    if (depErr || !deployment) continue;

    const hostingUrls = buildDeploymentHostingUrls({
      appUrl,
      slug: project.slug,
      deploymentId: deployment.id,
    });
    const adapter = resolveHostingProviderAdapter();

    await admin
      .from("deployments")
      .update({
        hosting_provider: adapter.name,
        preview_url: hostingUrls.previewUrl,
        production_url:
          decision.environment === "production" ? hostingUrls.productionUrl : null,
      })
      .eq("id", deployment.id);

    try {
      const jobId = await enqueueBuildJob({
        deploymentId: deployment.id,
        projectId: project.id,
        userId: project.user_id,
        environment: decision.environment,
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
