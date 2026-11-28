import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import {
  fetchRepositoryIntelligenceInputs,
  resolveConnectionToken,
} from "@/lib/github/client";
import { analyzeDeployReadiness } from "@/lib/intelligence/deploy-analyzer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import type { FrameworkType } from "@/types/database";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const rl = checkRateLimit(`deploy-analyze:${user.id}`, 20, 60_000);
  if (!rl.allowed) return rateLimitExceededResponse(rl);

  const [{ data: project }, { data: envRows }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, framework, repo_full_name, default_branch, root_directory, install_command, build_command, output_directory, node_version, github_connection_id"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("project_env_vars")
      .select("key")
      .eq("project_id", id)
      .eq("user_id", user.id),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let token: string | null = null;
  if (project.github_connection_id) {
    const { data: conn } = await supabase
      .from("github_connections")
      .select("id, provider_type, installation_id, encrypted_access_token, token_expires_at")
      .eq("id", project.github_connection_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (conn) {
      try {
        token = await resolveConnectionToken(conn);
      } catch {
        token = null;
      }
    }
  }

  let repoInputs = {
    rootFiles: [] as string[],
    packageJsonRaw: null as string | null,
    nextConfigRaw: null as string | null,
    viteConfigRaw: null as string | null,
    envExampleRaw: null as string | null,
  };

  if (project.repo_full_name) {
    try {
      repoInputs = await fetchRepositoryIntelligenceInputs(
        token,
        project.repo_full_name,
        project.default_branch,
        project.root_directory
      );
    } catch {
      // Keep static fallback if GitHub API is unreachable
    }
  }

  const report = analyzeDeployReadiness({
    framework: project.framework as FrameworkType,
    installCommand: project.install_command,
    buildCommand: project.build_command,
    outputDirectory: project.output_directory,
    nodeVersion: project.node_version,
    rootFiles: repoInputs.rootFiles,
    packageJsonRaw: repoInputs.packageJsonRaw,
    nextConfigRaw: repoInputs.nextConfigRaw,
    viteConfigRaw: repoInputs.viteConfigRaw,
    envExampleRaw: repoInputs.envExampleRaw,
    configuredEnvKeys: (envRows ?? []).map((e) => e.key),
  });

  return NextResponse.json({ report });
}
