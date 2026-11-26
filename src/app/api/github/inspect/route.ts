import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import {
  inspectRepositoryFramework,
  resolveConnectionToken,
} from "@/lib/github/client";

const inspectSchema = z.object({
  connectionId: z.string().uuid(),
  repoFullName: z.string().min(3),
  branch: z.string().min(1).default("main"),
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

  const { data: connection } = await supabase
    .from("github_connections")
    .select("id, provider_type, installation_id, encrypted_access_token")
    .eq("id", parsed.data.connectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "GitHub connection not found" }, { status: 404 });
  }

  try {
    const token = await resolveConnectionToken(connection);
    const inspection = await inspectRepositoryFramework(
      token,
      parsed.data.repoFullName,
      parsed.data.branch,
      parsed.data.rootDirectory
    );
    return NextResponse.json(inspection);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to inspect repository" },
      { status: 502 }
    );
  }
}
