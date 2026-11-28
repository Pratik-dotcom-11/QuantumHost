import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { getServerSupabaseServiceKey } from "@/lib/env";
import { fetchGitHubPrimaryEmail, verifyGitHubToken } from "@/lib/github/client";
import { sanitizeRelativeRedirectPath } from "@/lib/security/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const { searchParams } = requestUrl;

  const oauthError = searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(searchParams.get("error_description") || oauthError)}`
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("qh_github_login_state")?.value;
  const savedNext = sanitizeRelativeRedirectPath(
    cookieStore.get("qh_github_login_next")?.value,
    "/dashboard"
  );

  cookieStore.delete("qh_github_login_state");
  cookieStore.delete("qh_github_login_next");

  const stateMatches =
    Boolean(state && savedState && state.length === savedState.length) &&
    timingSafeEqual(Buffer.from(state!), Buffer.from(savedState!));

  if (!code || !stateMatches) {
    return NextResponse.redirect(`${origin}/login?error=github_invalid_state`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const serviceKey = getServerSupabaseServiceKey();

  if (!clientId || !clientSecret || !serviceKey) {
    return NextResponse.redirect(`${origin}/login?error=github_setup_required`);
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
        redirect_uri: `${origin}/api/auth/github/callback`,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(
          tokenData.error_description || "github_token_exchange_failed"
        )}`
      );
    }

    const ghUser = await verifyGitHubToken(tokenData.access_token);
    const email = ghUser.email?.trim() || (await fetchGitHubPrimaryEmail(tokenData.access_token));

    if (!email) {
      return NextResponse.redirect(`${origin}/login?error=github_email_required`);
    }

    const admin = createAdminClient();

    // Ensure user exists or create via admin API before generating a magiclink OTP
    let { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: {
          full_name: ghUser.name || ghUser.login,
          avatar_url: ghUser.avatar_url,
          user_name: ghUser.login,
          preferred_username: ghUser.login,
        },
      },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: ghUser.name || ghUser.login,
          avatar_url: ghUser.avatar_url,
          user_name: ghUser.login,
          preferred_username: ghUser.login,
        },
      });

      const retry = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      linkData = retry.data;
      linkError = retry.error;
    }

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    const supabase = await createClient();
    const { data: verifiedData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });

    if (verifyError || !verifiedData.user) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    const userId = verifiedData.user.id;

    // Best-effort profile and GitHub token persistence so user can immediately import repos
    try {
      await admin.from("profiles").upsert(
        {
          id: userId,
          email,
          full_name: ghUser.name || ghUser.login,
          username: ghUser.login,
          avatar_url: ghUser.avatar_url,
        },
        { onConflict: "id" }
      );
    } catch {
      // Non-fatal profile sync error
    }

    try {
      const encrypted = encryptSecret(tokenData.access_token);
      await admin.from("github_connections").upsert(
        {
          user_id: userId,
          provider_type: "oauth",
          github_user_id: ghUser.id,
          github_login: ghUser.login,
          encrypted_access_token: encrypted,
          scopes: tokenData.scope ? tokenData.scope.split(",").map((s) => s.trim()) : ["repo"],
        },
        { onConflict: "user_id,github_login,provider_type" }
      );
    } catch {
      // Non-fatal if ENCRYPTION_MASTER_KEY is unset
    }

    return NextResponse.redirect(`${origin}${savedNext}`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
