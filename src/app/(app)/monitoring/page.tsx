import { requirePageUser } from "@/lib/auth";
import { MonitoringClient } from "@/components/monitoring/monitoring-client";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: projects }, { data: monitors }, { data: checks }] = await Promise.all([
    supabase.from("projects").select("id, name, slug").eq("user_id", user.id),
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
      .limit(120),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Availability Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Execute live HTTP health checks and inspect endpoint latency across your deployments.
        </p>
      </div>
      <MonitoringClient
        projects={projects ?? []}
        initialMonitors={monitors ?? []}
        initialChecks={checks ?? []}
      />
    </div>
  );
}
