import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { resolveRequestAppUrl } from "@/lib/env";
import { verifyGitHubToken } from "@/lib/github/client";

export async function GET(request: Request) {
  const { supabase, user } = await requireApiUser();
  const appUrl = resolveRequestAppUrl(request);
  const { searchParams } = new URL(request.url);

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?next=/settings`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const installationId = searchParams.get("installation_id");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("qh_github_oauth_state")?.value;

  const stateMatches =
    Boolean(state && savedState && state.length === savedState.length) &&
    timingSafeEqual(Buffer.from(state!), Buffer.from(savedState!));

  if (!code || !stateMatches) {
    return NextResponse.redirect(`${appUrl}/settings?github_error=invalid_state`);
  }

  cookieStore.delete("qh_github_oauth_state");

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings?github_error=missing_oauth_config`);
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/github/oauth/callback`,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        `${appUrl}/settings?github_error=${encodeURIComponent(
          tokenData.error_description || "token_exchange_failed"
        )}`
      );
    }

    const ghUser = await verifyGitHubToken(tokenData.access_token);
    let encrypted: string;
    try {
      encrypted = encryptSecret(tokenData.access_token);
    } catch {
      return NextResponse.redirect(`${appUrl}/settings?github_error=encryption_key_missing`);
    }
    const parsedInstallation = installationId ? Number.parseInt(installationId, 10) : null;

    await supabase.from("github_connections").upsert(
      {
        user_id: user.id,
        provider_type: parsedInstallation ? "github_app" : "oauth",
        github_user_id: ghUser.id,
        github_login: ghUser.login,
        installation_id: Number.isFinite(parsedInstallation) ? parsedInstallation : null,
        encrypted_access_token: encrypted,
        scopes: tokenData.scope ? tokenData.scope.split(",").map((s) => s.trim()) : ["repo"],
      },
      { onConflict: "user_id,github_login,provider_type" }
    );

    return NextResponse.redirect(`${appUrl}/settings?github_connected=1`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?github_error=oauth_exception`);
  }
}
