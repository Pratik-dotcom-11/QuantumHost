import { NextResponse } from "next/server";
import { getServerSupabaseServiceKey } from "@/lib/env";
import { runHttpProbe } from "@/lib/monitoring/prober";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
  }

  if (!cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET must be configured in production to execute scheduled monitors." },
      { status: 503 }
    );
  }

  if (!getServerSupabaseServiceKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for scheduled background health checks." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const { data: monitors, error } = await admin
    .from("uptime_monitors")
    .select("*")
    .eq("is_enabled", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nowMs = Date.now();
  const dueMonitors = (monitors ?? []).filter((m) => {
    if (!m.last_checked_at) return true;
    const elapsedSec = (nowMs - new Date(m.last_checked_at).getTime()) / 1000;
    return elapsedSec >= Math.max(60, m.interval_seconds - 5);
  });

  const checked = [];
  for (const monitor of dueMonitors) {
    const probe = await runHttpProbe(monitor.target_url);
    const nowIso = new Date().toISOString();

    await Promise.all([
      admin.from("uptime_checks").insert({
        monitor_id: monitor.id,
        project_id: monitor.project_id,
        user_id: monitor.user_id,
        status: probe.status,
        http_status: probe.httpStatus,
        latency_ms: probe.latencyMs,
        error_message: probe.errorMessage,
        checked_at: nowIso,
      }),
      admin
        .from("uptime_monitors")
        .update({
          last_status: probe.status,
          last_http_status: probe.httpStatus,
          last_latency_ms: probe.latencyMs,
          last_checked_at: nowIso,
        })
        .eq("id", monitor.id),
    ]);

    checked.push({ monitorId: monitor.id, status: probe.status, latencyMs: probe.latencyMs });
  }

  return NextResponse.json({
    ok: true,
    totalEnabled: monitors?.length ?? 0,
    executed: checked.length,
    checked,
  });
}
