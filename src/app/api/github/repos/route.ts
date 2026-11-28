import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import {
  getLatestCommit,
  getRepositoryMetadata,
  isValidRepoFullName,
  listBranches,
  listRepositories,
  resolveConnectionToken,
} from "@/lib/github/client";

export async function GET(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  const repoFullName = searchParams.get("repo");
  const query = searchParams.get("q")?.trim().toLowerCase() || "";

  if (repoFullName && !isValidRepoFullName(repoFullName)) {
    return NextResponse.json(
      { error: "Invalid repository identifier. Use owner/repository format." },
      { status: 400 }
    );
  }

  let token: string | null = null;
  let providerType = "public";

  if (connectionId) {
    const { data: connection, error } = await supabase
      .from("github_connections")
      .select("id, provider_type, installation_id, encrypted_access_token, token_expires_at")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !connection) {
      return NextResponse.json({ error: "GitHub connection not found" }, { status: 404 });
    }

    providerType = connection.provider_type;
    try {
      token = await resolveConnectionToken(connection, async (encryptedToken, expiresAt) => {
        await supabase
          .from("github_connections")
          .update({ encrypted_access_token: encryptedToken, token_expires_at: expiresAt })
          .eq("id", connection.id)
          .eq("user_id", user.id);
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to authenticate GitHub connection" },
        { status: 502 }
      );
    }
  } else if (!repoFullName) {
    return NextResponse.json({ error: "connectionId is required to list account repositories" }, { status: 400 });
  }

  try {
    if (repoFullName) {
      const metadata = await getRepositoryMetadata(token, repoFullName);
      if (metadata.permissions?.pull === false) {
        return NextResponse.json({ error: "Insufficient repository permissions" }, { status: 403 });
      }
      const [branches, latestCommit] = await Promise.all([
        listBranches(token, metadata.full_name),
        getLatestCommit(token, metadata.full_name, metadata.default_branch || "main"),
      ]);
      return NextResponse.json({
        branches,
        metadata: {
          id: metadata.id,
          name: metadata.name,
          full_name: metadata.full_name,
          private: metadata.private,
          html_url: metadata.html_url,
          default_branch: metadata.default_branch,
          description: metadata.description,
          language: metadata.language,
        },
        latestCommit,
      });
    }

    const repos = await listRepositories(token!, providerType);
    const filtered = query
      ? repos.filter(
          (r) =>
            r.full_name.toLowerCase().includes(query) ||
            (r.description || "").toLowerCase().includes(query) ||
            (r.language || "").toLowerCase().includes(query)
        )
      : repos;

    return NextResponse.json({ repos: filtered });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to query GitHub API" },
      { status: 502 }
    );
  }
}
