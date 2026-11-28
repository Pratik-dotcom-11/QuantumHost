import { requirePageUser } from "@/lib/auth";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import type { AiProviderType } from "@/types/database";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: profile }, { data: connections }, { data: aiRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, plan")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("github_connections")
      .select("id, provider_type, github_login, installation_id, scopes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_configurations")
      .select("provider, model, base_url, encrypted_api_key, is_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  let maskedKey: string | null = null;
  if (aiRow?.encrypted_api_key) {
    try {
      maskedKey = maskSecret(decryptSecret(aiRow.encrypted_api_key));
    } catch {
      maskedKey = "••••••";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, GitHub source integrations, and provider-independent AI credentials.
        </p>
      </div>
      <SettingsClient
        initialProfile={{
          email: profile?.email || user.email || "",
          fullName: profile?.full_name || user.email?.split("@")[0] || "Developer",
          plan: profile?.plan || "developer",
        }}
        initialConnections={connections ?? []}
        oauthConfigured={Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}
        appSlug={process.env.GITHUB_APP_SLUG?.trim() || null}
        initialAiConfig={{
          provider: (aiRow?.provider || process.env.AI_PROVIDER || "gemini") as AiProviderType,
          model: aiRow?.model || process.env.AI_MODEL || "gemini-2.5-flash",
          baseUrl: aiRow?.base_url || process.env.AI_BASE_URL || null,
          hasUserApiKey: Boolean(aiRow?.encrypted_api_key),
          maskedKey,
          isEnabled: aiRow?.is_enabled ?? true,
        }}
        serverAiConfigured={Boolean(process.env.AI_API_KEY?.trim())}
      />
    </div>
  );
}
