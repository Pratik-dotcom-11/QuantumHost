import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { runHttpProbe } from "@/lib/monitoring/prober";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";

const checkSchema = z.object({
  monitorId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const rl = checkRateLimit(`monitor-probe:${user.id}`, 20, 60_000);
  if (!rl.allowed) return rateLimitExceededResponse(rl);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let query = supabase
    .from("uptime_monitors")
    .select("*")
    .eq("user_id", user.id);

  if (parsed.data.monitorId) {
    query = query.eq("id", parsed.data.monitorId);
  } else {
    query = query.eq("is_enabled", true);
  }

  const { data: monitors, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const monitor of monitors ?? []) {
    const probe = await runHttpProbe(monitor.target_url);
    const now = new Date().toISOString();

    await Promise.all([
      supabase.from("uptime_checks").insert({
        monitor_id: monitor.id,
        project_id: monitor.project_id,
        user_id: user.id,
        status: probe.status,
        http_status: probe.httpStatus,
        latency_ms: probe.latencyMs,
        error_message: probe.errorMessage,
        checked_at: now,
      }),
      supabase
        .from("uptime_monitors")
        .update({
          last_status: probe.status,
          last_http_status: probe.httpStatus,
          last_latency_ms: probe.latencyMs,
          last_checked_at: now,
        })
        .eq("id", monitor.id)
        .eq("user_id", user.id),
    ]);

    results.push({ monitorId: monitor.id, targetUrl: monitor.target_url, ...probe });
  }

  return NextResponse.json({ results });
}
