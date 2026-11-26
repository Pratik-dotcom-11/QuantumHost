import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

const upsertEnvSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Z_][A-Z0-9_]*$/, "Key must be uppercase letters, numbers, and underscores"),
  value: z.string().min(1, "Value is required"),
  isSecret: z.boolean().default(true),
  environment: z.enum(["production", "preview", "all"]).default("production"),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("project_env_vars")
    .select("id, key, encrypted_value, is_secret, environment, created_at, updated_at")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .order("key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const variables = (data ?? []).map((row) => {
    let preview = "••••••";
    try {
      const plain = decryptSecret(row.encrypted_value);
      preview = row.is_secret ? maskSecret(plain) : plain;
    } catch {
      preview = "••••••";
    }
    return {
      id: row.id,
      key: row.key,
      isSecret: row.is_secret,
      environment: row.environment,
      preview,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({ variables });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = upsertEnvSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const encryptedValue = encryptSecret(parsed.data.value);
  const { data, error } = await supabase
    .from("project_env_vars")
    .upsert(
      {
        project_id: id,
        user_id: user.id,
        key: parsed.data.key,
        encrypted_value: encryptedValue,
        is_secret: parsed.data.isSecret,
        environment: parsed.data.environment,
      },
      { onConflict: "project_id,key,environment" }
    )
    .select("id, key, is_secret, environment, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ variable: data }, { status: 201 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { searchParams } = new URL(request.url);
  const varId = searchParams.get("varId");
  if (!varId) {
    return NextResponse.json({ error: "varId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_env_vars")
    .delete()
    .eq("id", varId)
    .eq("project_id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
