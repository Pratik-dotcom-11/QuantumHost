"use client";

import React, { useState } from "react";
import { Activity, Loader2, Play, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { UptimeStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

interface MonitorRow {
  id: string;
  project_id: string;
  target_url: string;
  interval_seconds: number;
  is_enabled: boolean;
  last_status: string;
  last_http_status: number | null;
  last_latency_ms: number | null;
  last_checked_at: string | null;
}

interface CheckRow {
  id: number;
  monitor_id: string;
  project_id: string;
  status: string;
  http_status: number | null;
  latency_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export function MonitoringClient({
  projects,
  initialMonitors,
  initialChecks,
}: {
  projects: Array<{ id: string; name: string; slug: string }>;
  initialMonitors: MonitorRow[];
  initialChecks: CheckRow[];
}) {
  const { toast } = useToast();
  const [monitors, setMonitors] = useState(initialMonitors);
  const [checks, setChecks] = useState(initialChecks);
  const [runningId, setRunningId] = useState<string | "all" | null>(null);

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  async function refreshState() {
    const res = await fetch("/api/monitoring");
    if (!res.ok) return;
    const json = (await res.json()) as { monitors?: MonitorRow[]; checks?: CheckRow[] };
    if (json.monitors) setMonitors(json.monitors);
    if (json.checks) setChecks(json.checks);
  }

  async function runCheck(monitorId?: string) {
    setRunningId(monitorId ?? "all");
    try {
      const res = await fetch("/api/monitoring/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monitorId ? { monitorId } : {}),
      });
      await refreshState();
      if (res.ok) {
        toast({
          title: "Availability probe complete",
          description: monitorId ? "Endpoint health updated." : "All enabled monitors checked.",
          variant: "success",
        });
      } else {
        toast({ title: "Probe failed", variant: "error" });
      }
    } finally {
      setRunningId(null);
    }
  }

  async function toggleEnabled(monitor: MonitorRow, enabled: boolean) {
    const res = await fetch("/api/monitoring", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitorId: monitor.id, isEnabled: enabled }),
    });
    if (res.ok) {
      setMonitors((prev) =>
        prev.map((m) => (m.id === monitor.id ? { ...m, is_enabled: enabled } : m))
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={() => runCheck()}
          disabled={runningId !== null || monitors.length === 0}
        >
          {runningId === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Run All Probes Now
        </Button>
      </div>

      {monitors.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No availability monitors yet"
          description="Monitors are automatically provisioned whenever you create or import a project."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {monitors.map((monitor) => {
            const proj = projectMap.get(monitor.project_id);
            const recent = checks
              .filter((c) => c.monitor_id === monitor.id)
              .slice(0, 12)
              .reverse();

            return (
              <Card key={monitor.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="truncate">{proj?.name || "Project"}</CardTitle>
                      <UptimeStatusBadge status={monitor.last_status} />
                    </div>
                    <CardDescription className="mt-1 truncate font-mono text-xs">
                      {monitor.target_url}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={monitor.is_enabled}
                    onCheckedChange={(val) => toggleEnabled(monitor, val)}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">HTTP Status</p>
                      <p className="mt-0.5 font-mono font-semibold text-foreground">
                        {monitor.last_http_status ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Latency</p>
                      <p className="mt-0.5 font-mono font-semibold text-foreground">
                        {monitor.last_latency_ms !== null ? `${monitor.last_latency_ms} ms` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Checked</p>
                      <p className="mt-0.5 font-mono text-foreground">
                        {formatRelativeTime(monitor.last_checked_at)}
                      </p>
                    </div>
                  </div>

                  {/* Mini uptime bar strip */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Recent probe history</span>
                      <span>{recent.length} checks</span>
                    </div>
                    <div className="flex h-6 items-center gap-1">
                      {recent.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No probes executed yet.</span>
                      ) : (
                        recent.map((c) => (
                          <div
                            key={c.id}
                            title={`${c.status.toUpperCase()} · HTTP ${c.http_status ?? "ERR"} · ${
                              c.latency_ms ?? 0
                            }ms`}
                            className={`h-full flex-1 rounded-xs ${
                              c.status === "up"
                                ? "bg-emerald-400/80"
                                : c.status === "degraded"
                                ? "bg-amber-400/80"
                                : "bg-rose-500/80"
                            }`}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => runCheck(monitor.id)}
                    disabled={runningId !== null}
                  >
                    {runningId === monitor.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Probe Endpoint Now
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
