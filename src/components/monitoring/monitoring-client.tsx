"use client";

import React, { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import {
  AnimatedCounter,
  SpotlightCard,
  StaggerGroup,
  StaggerItem,
} from "@/components/motion/primitives";
import { UptimeStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
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

function LatencySparkline({ checks }: { checks: CheckRow[] }) {
  const values = checks
    .map((c) => c.latency_ms)
    .filter((v): v is number => typeof v === "number" && v >= 0);

  if (values.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center rounded-lg border border-[#221c16] bg-[#0b0907] text-[11px] text-[#9a9084]">
        Run at least 2 probes to chart response latency
      </div>
    );
  }

  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const width = 300;
  const height = 52;
  const padY = 6;

  const points = values
    .map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - padY - ((val - min) / range) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-[#221c16] bg-[#0b0907] p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full overflow-visible"
        role="img"
        aria-label="Response time latency chart"
      >
        <polyline
          fill="none"
          stroke="#f4ba4a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
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

  async function changeInterval(monitorId: string, intervalSeconds: number) {
    const res = await fetch("/api/monitoring", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitorId, intervalSeconds }),
    });
    if (res.ok) {
      setMonitors((prev) =>
        prev.map((m) => (m.id === monitorId ? { ...m, interval_seconds: intervalSeconds } : m))
      );
      toast({
        title: "Schedule updated",
        description: `Health probe interval set to every ${Math.round(intervalSeconds / 60)}m.`,
        variant: "success",
      });
    }
  }

  const totalChecks = checks.length;
  const upChecks = checks.filter((c) => c.status === "up").length;
  const overallAvailability = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 1000) / 10 : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9a9084]">
          <span>
            Scheduled cron endpoint: <code className="font-mono text-[#f7f3ec]">GET /api/monitoring/cron</code>
          </span>
          {overallAvailability !== null ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-emerald-300">
              {overallAvailability}% overall uptime ({upChecks}/{totalChecks} probes)
            </span>
          ) : null}
        </div>
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
        <StaggerGroup className="grid gap-4 md:grid-cols-2" viewport={false} stagger={0.06}>
          {monitors.map((monitor) => {
            const proj = projectMap.get(monitor.project_id);
            const allMonitorChecks = checks.filter((c) => c.monitor_id === monitor.id);
            const recent = allMonitorChecks.slice(0, 18).reverse();
            const lastSuccess = allMonitorChecks.find((c) => c.status === "up");
            const recentFailures = allMonitorChecks
              .filter((c) => c.status === "down" || c.status === "degraded")
              .slice(0, 3);
            const monitorUpCount = allMonitorChecks.filter((c) => c.status === "up").length;
            const uptimePct =
              allMonitorChecks.length > 0
                ? ((monitorUpCount / allMonitorChecks.length) * 100).toFixed(1)
                : null;

            return (
              <StaggerItem key={monitor.id}>
                <SpotlightCard>
                  <Card className="border-0 bg-transparent shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="truncate">{proj?.name || "Project"}</CardTitle>
                          <UptimeStatusBadge status={monitor.last_status} />
                          {uptimePct !== null ? (
                            <span className="font-mono text-[11px] text-emerald-300">
                              {uptimePct}% up
                            </span>
                          ) : null}
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
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">HTTP Status</p>
                          <p className="mt-0.5 font-mono font-semibold text-foreground">
                            {monitor.last_http_status ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Latency</p>
                          <p className="mt-0.5 font-mono font-semibold text-foreground">
                            {monitor.last_latency_ms !== null ? (
                              <AnimatedCounter value={monitor.last_latency_ms} suffix=" ms" />
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Check</p>
                          <p className="mt-0.5 font-mono text-foreground">
                            {formatRelativeTime(monitor.last_checked_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Healthy</p>
                          <p className="mt-0.5 font-mono text-emerald-300">
                            {lastSuccess ? formatRelativeTime(lastSuccess.checked_at) : "Never"}
                          </p>
                        </div>
                      </div>

                      {/* Latency Curve */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Response Latency Trend (ms)</span>
                          <span>Last {recent.length} checks</span>
                        </div>
                        <LatencySparkline checks={recent} />
                      </div>

                      {/* Mini uptime bar strip */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Availability History</span>
                          <span>{allMonitorChecks.length} total recorded</span>
                        </div>
                        <div className="flex h-5 items-center gap-1">
                          {recent.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No probes executed yet.</span>
                          ) : (
                            recent.map((c) => (
                              <div
                                key={c.id}
                                title={`${c.status.toUpperCase()} · HTTP ${c.http_status ?? "ERR"} · ${
                                  c.latency_ms ?? 0
                                }ms · ${c.checked_at}`}
                                className={`h-full flex-1 rounded-xs transition-transform duration-150 hover:scale-y-110 ${
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

                      {/* Recent Failures */}
                      {recentFailures.length > 0 ? (
                        <div className="space-y-1 rounded-xl border border-rose-500/25 bg-rose-500/8 p-2.5 text-[11px]">
                          <p className="flex items-center gap-1 font-semibold text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            Recent Failures / Degraded Probes
                          </p>
                          {recentFailures.map((fail) => (
                            <div
                              key={fail.id}
                              className="flex items-center justify-between gap-2 font-mono text-rose-200/90"
                            >
                              <span className="truncate">
                                {fail.error_message || `HTTP ${fail.http_status ?? "error"}`}
                              </span>
                              <span className="shrink-0 text-[#9a9084]">
                                {formatRelativeTime(fail.checked_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : allMonitorChecks.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          No recent probe failures recorded.
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <Select
                          value={String(monitor.interval_seconds)}
                          onChange={(e) => changeInterval(monitor.id, Number(e.target.value))}
                          className="h-8 w-32 text-xs"
                          aria-label="Probe schedule interval"
                        >
                          <option value="60">Every 1 min</option>
                          <option value="300">Every 5 min</option>
                          <option value="900">Every 15 min</option>
                          <option value="3600">Every 60 min</option>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
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
                      </div>
                    </CardContent>
                  </Card>
                </SpotlightCard>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      )}
    </div>
  );
}
