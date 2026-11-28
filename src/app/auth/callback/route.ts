import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { verifyGitHubToken } from "@/lib/github/client";
import { sanitizeRelativeRedirectPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");
  const safeNext = sanitizeRelativeRedirectPath(searchParams.get("next"), "/dashboard");

  if (oauthError || oauthErrorDesc) {
    const combined = `${oauthError || ""} ${oauthErrorDesc || ""}`.toLowerCase();
    if (combined.includes("unsupported provider") || combined.includes("provider is not enabled")) {
      return NextResponse.redirect(
        `${origin}/login?error=github_setup_required&next=${encodeURIComponent(safeNext)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(oauthErrorDesc || oauthError || "auth_callback_failed")}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If Supabase returned a GitHub provider_token, save it so the user can immediately import repos
      const providerToken = data.session?.provider_token;
      const userId = data.session?.user?.id;
      if (providerToken && userId) {
        try {
          const ghUser = await verifyGitHubToken(providerToken);
          const encrypted = encryptSecret(providerToken);
          await supabase.from("github_connections").upsert(
            {
              user_id: userId,
              provider_type: "oauth",
              github_user_id: ghUser.id,
              github_login: ghUser.login,
              encrypted_access_token: encrypted,
              scopes: ["read:user", "user:email", "repo"],
            },
            { onConflict: "user_id,github_login,provider_type" }
          );
        } catch {
          // Non-fatal: login still succeeds even if token encryption or repo scope is unavailable
        }
      }

      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
