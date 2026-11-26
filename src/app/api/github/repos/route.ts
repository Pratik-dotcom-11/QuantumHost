import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import {
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

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }

  const { data: connection, error } = await supabase
    .from("github_connections")
    .select("id, provider_type, installation_id, encrypted_access_token")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !connection) {
    return NextResponse.json({ error: "GitHub connection not found" }, { status: 404 });
  }

  try {
    const token = await resolveConnectionToken(connection);

    if (repoFullName) {
      const branches = await listBranches(token, repoFullName);
      return NextResponse.json({ branches });
    }

    const repos = await listRepositories(token, connection.provider_type);
    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to query GitHub API" },
      { status: 502 }
    );
  }
}
