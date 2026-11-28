import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { invalidUuidResponse, isValidUuid } from "@/lib/security/validation";
import type { Database } from "@/types/database";

const updateProjectSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(500).nullable().optional(),
  framework: z.enum(["nextjs", "vite", "react", "astro", "static", "node", "custom"]).optional(),
  defaultBranch: z.string().min(1).max(100).optional(),
  rootDirectory: z.string().min(1).max(200).optional(),
  installCommand: z.string().max(300).optional(),
  buildCommand: z.string().max(300).optional(),
  outputDirectory: z.string().min(1).max(200).optional(),
  nodeVersion: z.enum(["18", "20", "22", "24"]).optional(),
  autoDeploy: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isValidUuid(id)) return invalidUuidResponse("project");
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, name, slug, framework, github_connection_id, repo_full_name, repo_url, default_branch, root_directory, install_command, build_command, output_directory, node_version, auto_deploy, webhook_id, active_deployment_id, created_at, updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isValidUuid(id)) return invalidUuidResponse("project");
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updates.description = parsed.data.description?.trim() || null;
  if (parsed.data.framework !== undefined) updates.framework = parsed.data.framework;
  if (parsed.data.defaultBranch !== undefined) updates.default_branch = parsed.data.defaultBranch.trim();
  if (parsed.data.rootDirectory !== undefined) updates.root_directory = parsed.data.rootDirectory.trim();
  if (parsed.data.installCommand !== undefined) updates.install_command = parsed.data.installCommand.trim();
  if (parsed.data.buildCommand !== undefined) updates.build_command = parsed.data.buildCommand.trim();
  if (parsed.data.outputDirectory !== undefined) updates.output_directory = parsed.data.outputDirectory.trim();
  if (parsed.data.nodeVersion !== undefined) updates.node_version = parsed.data.nodeVersion;
  if (parsed.data.autoDeploy !== undefined) updates.auto_deploy = parsed.data.autoDeploy;

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(
      "id, name, slug, framework, repo_full_name, repo_url, default_branch, root_directory, install_command, build_command, output_directory, node_version, auto_deploy, active_deployment_id, updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Project not found" },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ project: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isValidUuid(id)) return invalidUuidResponse("project");
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
