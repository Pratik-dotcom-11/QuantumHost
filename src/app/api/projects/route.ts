import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { resolveRequestAppUrl } from "@/lib/env";
import {
  getRepositoryMetadata,
  isValidRepoFullName,
  registerRepoWebhook,
  resolveConnectionToken,
} from "@/lib/github/client";
import { slugify } from "@/lib/utils";

const createProjectSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z.string().min(3).max(63).optional(),
  description: z.string().max(500).nullable().optional(),
  githubConnectionId: z.string().uuid().nullable().optional(),
  repoFullName: z.string().min(3).max(200).nullable().optional(),
  repoId: z.number().int().positive().nullable().optional(),
  repoUrl: z.string().url().nullable().optional(),
  framework: z.enum(["nextjs", "vite", "react", "astro", "static", "node", "custom"]).default("static"),
  defaultBranch: z.string().min(1).max(100).default("main"),
  rootDirectory: z.string().min(1).max(200).default("."),
  installCommand: z.string().max(300).default("npm ci"),
  buildCommand: z.string().max(300).default("npm run build"),
  outputDirectory: z.string().min(1).max(200).default("dist"),
  nodeVersion: z.enum(["18", "20", "22", "24"]).default("20"),
  autoDeploy: z.boolean().default(true),
  registerWebhook: z.boolean().default(false),
});

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, slug, description, framework, repo_full_name, repo_url, default_branch, root_directory, install_command, build_command, output_directory, node_version, auto_deploy, active_deployment_id, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data ?? [] });
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

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const normalizedSlug = slugify(input.slug || input.name);

  if (input.repoFullName && !isValidRepoFullName(input.repoFullName)) {
    return NextResponse.json(
      { error: "Invalid repository identifier. Use owner/repository format." },
      { status: 400 }
    );
  }

  let connectionToken: string | null = null;
  let verifiedRepoId = input.repoId ?? null;
  let verifiedRepoUrl = input.repoUrl ?? null;

  if (input.githubConnectionId) {
    const { data: conn } = await supabase
      .from("github_connections")
      .select("id, provider_type, installation_id, encrypted_access_token, token_expires_at")
      .eq("id", input.githubConnectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conn) {
      return NextResponse.json({ error: "Selected GitHub connection not found" }, { status: 404 });
    }

    if (input.repoFullName) {
      try {
        connectionToken = await resolveConnectionToken(conn, async (encryptedToken, expiresAt) => {
          await supabase
            .from("github_connections")
            .update({ encrypted_access_token: encryptedToken, token_expires_at: expiresAt })
            .eq("id", conn.id)
            .eq("user_id", user.id);
        });
        const repoMeta = await getRepositoryMetadata(connectionToken, input.repoFullName);
        if (repoMeta.permissions?.pull === false) {
          return NextResponse.json(
            { error: "Your connected GitHub account lacks read permissions for this repository." },
            { status: 403 }
          );
        }
        verifiedRepoId = repoMeta.id;
        verifiedRepoUrl = repoMeta.html_url;
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Unable to verify GitHub repository ownership or permissions.",
          },
          { status: 403 }
        );
      }
    }
  }

  const rawWebhookSecret = randomBytes(24).toString("hex");
  let encryptedWebhookSecret: string | null = null;
  try {
    encryptedWebhookSecret = encryptSecret(rawWebhookSecret);
  } catch {
    encryptedWebhookSecret = null;
  }

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      github_connection_id: input.githubConnectionId ?? null,
      name: input.name.trim(),
      slug: normalizedSlug,
      description: input.description?.trim() || null,
      framework: input.framework,
      repo_full_name: input.repoFullName?.trim() ?? null,
      repo_id: verifiedRepoId,
      repo_url: verifiedRepoUrl,
      default_branch: input.defaultBranch.trim(),
      root_directory: input.rootDirectory.trim(),
      install_command: input.installCommand.trim(),
      build_command: input.buildCommand.trim(),
      output_directory: input.outputDirectory.trim(),
      node_version: input.nodeVersion,
      auto_deploy: input.autoDeploy,
      webhook_secret_encrypted: encryptedWebhookSecret,
    })
    .select(
      "id, name, slug, framework, repo_full_name, repo_url, default_branch, root_directory, install_command, build_command, output_directory, node_version, auto_deploy, active_deployment_id, created_at"
    )
    .single();

  if (insertError || !project) {
    const isDuplicateSlug = insertError?.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicateSlug
          ? `A project with slug "${normalizedSlug}" already exists. Choose another slug.`
          : insertError?.message || "Failed to create project",
      },
      { status: isDuplicateSlug ? 409 : 500 }
    );
  }

  const appUrl = resolveRequestAppUrl(request);
  // Create default uptime monitor targeting the project's live route
  await supabase.from("uptime_monitors").insert({
    project_id: project.id,
    user_id: user.id,
    target_url: `${appUrl}/sites/${project.slug}`,
    interval_seconds: 300,
    is_enabled: true,
  });

  let webhookStatus: { registered: boolean; warning?: string } = { registered: false };
  if (input.registerWebhook && input.githubConnectionId && input.repoFullName) {
    if (!encryptedWebhookSecret) {
      webhookStatus = {
        registered: false,
        warning: "ENCRYPTION_MASTER_KEY is not configured; automatic GitHub webhook registration was skipped.",
      };
    } else {
      try {
      const { data: conn } = await supabase
        .from("github_connections")
        .select("provider_type, installation_id, encrypted_access_token")
        .eq("id", input.githubConnectionId)
        .eq("user_id", user.id)
        .single();

      if (conn) {
        const token = await resolveConnectionToken(conn);
        const hook = await registerRepoWebhook(
          token,
          input.repoFullName,
          `${appUrl}/api/webhooks/github`,
          rawWebhookSecret
        );
        await supabase
          .from("projects")
          .update({ webhook_id: hook.id })
          .eq("id", project.id)
          .eq("user_id", user.id);
        webhookStatus = { registered: true };
      }
    } catch (err) {
      webhookStatus = {
        registered: false,
        warning: err instanceof Error ? err.message : "Webhook registration failed",
      };
    }
    }
  }

  return NextResponse.json({ project, webhookStatus }, { status: 201 });
}
