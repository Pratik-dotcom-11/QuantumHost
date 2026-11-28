import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getInstallationAccessToken, verifyGitHubToken } from "@/lib/github/client";
import { invalidUuidResponse, isValidUuid } from "@/lib/security/validation";

const connectSchema = z.discriminatedUnion("providerType", [
  z.object({
    providerType: z.literal("pat"),
    accessToken: z.string().min(10, "Enter a valid GitHub Personal Access Token"),
  }),
  z.object({
    providerType: z.literal("github_app"),
    installationId: z.coerce.number().int().positive(),
    githubLogin: z.string().min(1),
  }),
]);

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data, error } = await supabase
    .from("github_connections")
    .select("id, provider_type, github_user_id, github_login, installation_id, scopes, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    connections: data ?? [],
    oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    appConfigured: Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY),
    appSlug: process.env.GITHUB_APP_SLUG || null,
  });
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

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.providerType === "pat") {
      const ghUser = await verifyGitHubToken(parsed.data.accessToken.trim());
      let encrypted: string;
      try {
        encrypted = encryptSecret(parsed.data.accessToken.trim());
      } catch (encErr) {
        return NextResponse.json(
          { error: encErr instanceof Error ? encErr.message : "Server encryption key is not configured." },
          { status: 503 }
        );
      }

      const { data, error } = await supabase
        .from("github_connections")
        .upsert(
          {
            user_id: user.id,
            provider_type: "pat",
            github_user_id: ghUser.id,
            github_login: ghUser.login,
            encrypted_access_token: encrypted,
            scopes: ["repo", "read:user"],
          },
          { onConflict: "user_id,github_login,provider_type" }
        )
        .select("id, provider_type, github_user_id, github_login, installation_id, scopes, created_at")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ connection: data }, { status: 201 });
    }

    // Verify GitHub App installation token minting works before saving
    await getInstallationAccessToken(parsed.data.installationId);

    const { data, error } = await supabase
      .from("github_connections")
      .upsert(
        {
          user_id: user.id,
          provider_type: "github_app",
          github_login: parsed.data.githubLogin.trim(),
          installation_id: parsed.data.installationId,
          scopes: ["github_app"],
        },
        { onConflict: "user_id,github_login,provider_type" }
      )
      .select("id, provider_type, github_user_id, github_login, installation_id, scopes, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ connection: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify GitHub connection" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Connection id is required" }, { status: 400 });
  }
  if (!isValidUuid(id)) return invalidUuidResponse("connection");

  const { error } = await supabase
    .from("github_connections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
