import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

const updateAiSchema = z.object({
  provider: z.enum(["gemini", "openai", "anthropic", "openai_compatible"]),
  model: z.string().min(2).max(120),
  baseUrl: z.string().url().nullable().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  isEnabled: z.boolean().default(true),
});

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data } = await supabase
    .from("ai_configurations")
    .select("id, provider, model, base_url, encrypted_api_key, is_enabled, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let maskedKey: string | null = null;
  if (data?.encrypted_api_key) {
    try {
      maskedKey = maskSecret(decryptSecret(data.encrypted_api_key));
    } catch {
      maskedKey = "••••••";
    }
  }

  return NextResponse.json({
    config: data
      ? {
          provider: data.provider,
          model: data.model,
          baseUrl: data.base_url,
          hasUserApiKey: Boolean(data.encrypted_api_key),
          maskedKey,
          isEnabled: data.is_enabled,
          updatedAt: data.updated_at,
        }
      : {
          provider: process.env.AI_PROVIDER || "gemini",
          model: process.env.AI_MODEL || "gemini-2.5-flash",
          baseUrl: process.env.AI_BASE_URL || null,
          hasUserApiKey: false,
          maskedKey: null,
          isEnabled: true,
          updatedAt: null,
        },
    serverDefaultConfigured: Boolean(process.env.AI_API_KEY?.trim()),
  });
}

export async function PUT(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateAiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("ai_configurations")
    .select("encrypted_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const encryptedApiKey = parsed.data.apiKey?.trim()
    ? encryptSecret(parsed.data.apiKey.trim())
    : existing?.encrypted_api_key ?? null;

  const { data, error } = await supabase
    .from("ai_configurations")
    .upsert(
      {
        user_id: user.id,
        provider: parsed.data.provider,
        model: parsed.data.model.trim(),
        base_url: parsed.data.baseUrl ? parsed.data.baseUrl.trim() : null,
        encrypted_api_key: encryptedApiKey,
        is_enabled: parsed.data.isEnabled,
      },
      { onConflict: "user_id" }
    )
    .select("provider, model, base_url, is_enabled, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data });
}
