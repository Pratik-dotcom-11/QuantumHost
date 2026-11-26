import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import type { Database } from "@/types/database";

const updateMonitorSchema = z.object({
  monitorId: z.string().uuid(),
  targetUrl: z.string().url().optional(),
  intervalSeconds: z.number().int().min(60).max(3600).optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const [{ data: monitors, error }, { data: checks }] = await Promise.all([
    supabase
      .from("uptime_monitors")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("uptime_checks")
      .select("*")
      .eq("user_id", user.id)
      .order("checked_at", { ascending: false })
      .limit(100),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ monitors: monitors ?? [], checks: checks ?? [] });
}

export async function PATCH(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Database["public"]["Tables"]["uptime_monitors"]["Update"] = {};
  if (parsed.data.targetUrl !== undefined) updates.target_url = parsed.data.targetUrl;
  if (parsed.data.intervalSeconds !== undefined) {
    updates.interval_seconds = parsed.data.intervalSeconds;
  }
  if (parsed.data.isEnabled !== undefined) updates.is_enabled = parsed.data.isEnabled;

  const { data, error } = await supabase
    .from("uptime_monitors")
    .update(updates)
    .eq("id", parsed.data.monitorId)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Monitor not found" },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ monitor: data });
}
