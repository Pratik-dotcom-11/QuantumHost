import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import type { Database } from "@/types/database";

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{1,37}[a-z0-9]$/, "Invalid username format")
    .nullable()
    .optional(),
});

export async function PATCH(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName;
  if (parsed.data.username !== undefined) updates.username = parsed.data.username;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No profile fields supplied" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id, email, full_name, username, plan")
    .single();

  if (error) {
    const isDuplicate = error.code === "23505";
    return NextResponse.json(
      { error: isDuplicate ? "That username is already taken." : error.message },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ profile: data });
}
