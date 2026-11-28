import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkGitHubAuthStatus } from "@/lib/auth/github-provider";
import { getPublicEnv } from "@/lib/env";
import { sanitizeRelativeRedirectPath } from "@/lib/security/redirect";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const safeNext = sanitizeRelativeRedirectPath(requestUrl.searchParams.get("next"), "/dashboard");
  const origin = requestUrl.origin;

  const status = await checkGitHubAuthStatus(false, origin);

  // Path 1: Direct GitHub OAuth Bridge (when GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and SUPABASE_SERVICE_ROLE_KEY are set)
  if (status.mode === "direct") {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.redirect(`${origin}/login?error=github_setup_required&next=${encodeURIComponent(safeNext)}`);
    }

    const state = randomBytes(24).toString("hex");
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";

    cookieStore.set("qh_github_login_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 600,
      path: "/",
    });

    cookieStore.set("qh_github_login_next", safeNext, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 600,
      path: "/",
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}/api/auth/github/callback`,
      scope: "read:user user:email repo",
      state,
    });

    return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }

  // Path 2: Native Supabase GitHub OAuth
  if (status.mode === "supabase") {
    const { supabaseUrl } = getPublicEnv();
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
    const params = new URLSearchParams({
      provider: "github",
      redirect_to: redirectTo,
      scopes: "read:user user:email repo",
    });

    return NextResponse.redirect(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/authorize?${params.toString()}`);
  }

  // Path 3: Neither is configured — never dump the user on Supabase's raw 400 JSON page
  return NextResponse.redirect(
    `${origin}/login?error=github_setup_required&next=${encodeURIComponent(safeNext)}`
  );
}
