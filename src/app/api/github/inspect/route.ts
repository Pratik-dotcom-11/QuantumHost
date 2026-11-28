import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import {
  getLatestCommit,
  getRepositoryMetadata,
  inspectRepositoryFramework,
  isValidRepoFullName,
  listBranches,
  resolveConnectionToken,
} from "@/lib/github/client";

const inspectSchema = z.object({
  connectionId: z.string().uuid().nullable().optional(),
  repoFullName: z.string().min(3).max(200),
  branch: z.string().min(1).max(100).optional(),
  rootDirectory: z.string().default("."),
});

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = inspectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!isValidRepoFullName(parsed.data.repoFullName)) {
    return NextResponse.json(
      { error: "Invalid repository identifier. Use owner/repository format." },
      { status: 400 }
    );
  }

  let token: string | null = null;
  if (parsed.data.connectionId) {
    const { data: connection } = await supabase
      .from("github_connections")
      .select("id, provider_type, installation_id, encrypted_access_token, token_expires_at")
      .eq("id", parsed.data.connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection) {
      return NextResponse.json({ error: "GitHub connection not found" }, { status: 404 });
    }

    token = await resolveConnectionToken(connection, async (encryptedToken, expiresAt) => {
      await supabase
        .from("github_connections")
        .update({ encrypted_access_token: encryptedToken, token_expires_at: expiresAt })
        .eq("id", connection.id)
        .eq("user_id", user.id);
    });
  }

  try {
    const metadata = await getRepositoryMetadata(token, parsed.data.repoFullName);
    if (metadata.permissions?.pull === false) {
      return NextResponse.json(
        { error: "Your GitHub connection does not have permission to read this repository." },
        { status: 403 }
      );
    }

    const targetBranch = parsed.data.branch?.trim() || metadata.default_branch || "main";
    const [inspection, branches, latestCommit] = await Promise.all([
      inspectRepositoryFramework(
        token,
        metadata.full_name,
        targetBranch,
        parsed.data.rootDirectory
      ),
      listBranches(token, metadata.full_name),
      getLatestCommit(token, metadata.full_name, targetBranch),
    ]);

    return NextResponse.json({
      ...inspection,
      branches,
      metadata: {
        id: metadata.id,
        name: metadata.name,
        full_name: metadata.full_name,
        private: metadata.private,
        html_url: metadata.html_url,
        default_branch: metadata.default_branch,
        description: metadata.description,
      },
      latestCommit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to inspect repository" },
      { status: 502 }
    );
  }
}
