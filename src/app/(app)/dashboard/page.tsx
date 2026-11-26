import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Cpu,
  GitBranch,
  Globe,
  Plus,
  Rocket,
  XCircle,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/utils";
import { QuickDeployButton } from "@/components/dashboard/quick-deploy-button";
import { DeploymentStatusBadge, UptimeStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser();

  const [
    { data: projects },
    { data: deployments },
    { data: domains },
    { data: monitors },
    { data: usageEvents },
    { data: githubConnections },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, slug, framework, repo_full_name, default_branch, active_deployment_id, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("deployments")
      .select(
        "id, project_id, deployment_number, status, environment, trigger_source, git_branch, git_commit_message, build_duration_ms, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("custom_domains")
      .select("id, verification_status")
      .eq("user_id", user.id),
    supabase
      .from("uptime_monitors")
      .select("id, project_id, last_status, last_latency_ms, last_checked_at")
      .eq("user_id", user.id),
    supabase
      .from("resource_usage_events")
      .select("metric_type, value")
      .eq("user_id", user.id)
      .limit(1000),
    supabase
      .from("github_connections")
      .select("id, github_login, provider_type")
      .eq("user_id", user.id),
  ]);

  const projectList = projects ?? [];
  const deploymentList = deployments ?? [];
  const monitorList = monitors ?? [];
  const projectMap = new Map(projectList.map((p) => [p.id, p]));

  const totalProjects = projectList.length;
  const activeCount = projectList.filter((p) => Boolean(p.active_deployment_id)).length;
  const successfulDeployments = deploymentList.filter((d) => d.status === "ready").length;
  const failedDeployments = deploymentList.filter((d) => d.status === "failed").length;
  const inProgressDeployments = deploymentList.filter((d) =>
    ["queued", "building", "uploading"].includes(d.status)
  ).length;
  const totalDeployments = deploymentList.length;

  const successRate =
    totalDeployments > 0 ? Math.round((successfulDeployments / totalDeployments) * 100) : 0;

  const monitorsUp = monitorList.filter((m) => m.last_status === "up").length;
  const monitorsDegraded = monitorList.filter((m) => m.last_status === "degraded").length;
  const monitorsDown = monitorList.filter((m) => m.last_status === "down").length;
  const latencyValues = monitorList
    .map((m) => m.last_latency_ms)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgLatencyMs =
    latencyValues.length > 0
      ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)
      : null;

  let buildSeconds = 0;
  let storageBytes = 0;
  let bandwidthBytes = 0;
  let httpRequests = 0;
  for (const ev of usageEvents ?? []) {
    const val = Number(ev.value) || 0;
    if (ev.metric_type === "build_seconds") buildSeconds += val;
    else if (ev.metric_type === "storage_bytes") storageBytes += val;
    else if (ev.metric_type === "bandwidth_bytes") bandwidthBytes += val;
    else if (ev.metric_type === "http_request") httpRequests += val;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b0f19]">
            Control Plane Overview
          </h1>
          <p className="mt-1 text-sm text-[#525b6c]">
            Real-time projects, deployment health, availability probes, and resource consumption.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!githubConnections?.length ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">
                <GitBranch className="h-4 w-4" />
                Connect GitHub
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/monitoring">
              <Activity className="h-4 w-4" />
              Website Health
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              Import Project
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Projects</CardDescription>
            <Boxes className="h-4 w-4 text-[#1d5bff]" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-[#0b0f19]">{totalProjects}</div>
            <p className="mt-1 text-xs text-[#525b6c]">
              {activeCount} serving active live URLs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Successful Deployments</CardDescription>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-emerald-600">
              {successfulDeployments}
            </div>
            <p className="mt-1 text-xs text-[#525b6c]">
              {totalDeployments > 0 ? `${successRate}% build success rate` : "No builds run yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Failed Deployments</CardDescription>
            <XCircle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-rose-600">
              {failedDeployments}
            </div>
            <p className="mt-1 text-xs text-[#525b6c]">
              {inProgressDeployments > 0
                ? `${inProgressDeployments} currently queued/building`
                : "AI failure diagnostics ready"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#060911] text-white border-[#0b0f19]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-slate-300">Website Health</CardDescription>
            <Activity className="h-4 w-4 text-[#60a5fa]" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-white">
              {monitorsUp}/{monitorList.length}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {avgLatencyMs !== null
                ? `Avg probe latency ${avgLatencyMs} ms`
                : `${monitorsDegraded} degraded · ${monitorsDown} down`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Status Distribution + Resource Usage */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deployment Status Distribution</CardTitle>
            <CardDescription>
              Live aggregate across all {totalDeployments} recorded builds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {totalDeployments > 0 ? (
                <>
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${(successfulDeployments / totalDeployments) * 100}%` }}
                    title={`Ready: ${successfulDeployments}`}
                  />
                  <div
                    className="bg-[#1d5bff] transition-all"
                    style={{ width: `${(inProgressDeployments / totalDeployments) * 100}%` }}
                    title={`Active: ${inProgressDeployments}`}
                  />
                  <div
                    className="bg-rose-500 transition-all"
                    style={{ width: `${(failedDeployments / totalDeployments) * 100}%` }}
                    title={`Failed: ${failedDeployments}`}
                  />
                </>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
                <span className="flex items-center gap-1.5 text-[#525b6c]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Ready
                </span>
                <p className="mt-1 font-mono text-base font-semibold text-[#0b0f19]">
                  {successfulDeployments}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
                <span className="flex items-center gap-1.5 text-[#525b6c]">
                  <span className="h-2 w-2 rounded-full bg-[#1d5bff]" />
                  In Queue / Build
                </span>
                <p className="mt-1 font-mono text-base font-semibold text-[#0b0f19]">
                  {inProgressDeployments}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
                <span className="flex items-center gap-1.5 text-[#525b6c]">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Failed
                </span>
                <p className="mt-1 font-mono text-base font-semibold text-[#0b0f19]">
                  {failedDeployments}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>Metered build compute, storage &amp; served traffic</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/usage">Details</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[#525b6c]">
                <Clock className="h-3.5 w-3.5 text-[#1d5bff]" />
                Build Time
              </div>
              <p className="mt-1.5 font-mono text-sm font-semibold text-[#0b0f19]">
                {buildSeconds.toFixed(1)}s
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[#525b6c]">
                <Cpu className="h-3.5 w-3.5 text-[#1d5bff]" />
                Storage
              </div>
              <p className="mt-1.5 font-mono text-sm font-semibold text-[#0b0f19]">
                {formatBytes(storageBytes)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[#525b6c]">
                <Globe className="h-3.5 w-3.5 text-[#1d5bff]" />
                Bandwidth
              </div>
              <p className="mt-1.5 font-mono text-sm font-semibold text-[#0b0f19]">
                {formatBytes(bandwidthBytes)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[#525b6c]">
                <Rocket className="h-3.5 w-3.5 text-[#1d5bff]" />
                Requests
              </div>
              <p className="mt-1.5 font-mono text-sm font-semibold text-[#0b0f19]">
                {httpRequests.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Deployment Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Projects &amp; Quick Deployment Actions</CardTitle>
              <CardDescription>
                Trigger isolated builds, inspect live routes, or configure repositories
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">All Projects</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {projectList.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="No projects yet"
                description="Import a GitHub repository to unlock one-click deployments, build logs, and uptime checks."
                action={
                  <Button asChild size="sm">
                    <Link href="/projects/new">Import Repository</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {projectList.slice(0, 6).map((project) => {
                  const monitor = monitorList.find((m) => m.project_id === project.id);
                  return (
                    <div
                      key={project.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f8f9fb] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="truncate font-semibold text-[#0b0f19] hover:text-[#1d5bff]"
                          >
                            {project.name}
                          </Link>
                          <span className="rounded bg-white border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-[#525b6c]">
                            {project.framework}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-[#525b6c]">
                          {project.repo_full_name || "No repository linked"} ·{" "}
                          {project.default_branch}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {monitor ? <UptimeStatusBadge status={monitor.last_status} /> : null}
                        <QuickDeployButton
                          projectId={project.id}
                          projectName={project.name}
                          branch={project.default_branch}
                          disabled={!project.repo_full_name}
                        />
                        {project.active_deployment_id ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/sites/${project.slug}`} target="_blank">
                              Live
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest builds across your workspace</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/deployments">History</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {deploymentList.length === 0 ? (
              <EmptyState
                icon={Rocket}
                title="No deployment activity yet"
                description="Deploy a project or push to a webhook-enabled branch to stream real-time activity here."
              />
            ) : (
              <div className="space-y-2.5">
                {deploymentList.slice(0, 7).map((dep) => {
                  const proj = projectMap.get(dep.project_id);
                  return (
                    <Link
                      key={dep.id}
                      href={`/deployments/${dep.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#f8f9fb] px-3.5 py-2.5 transition-colors hover:border-[#1d5bff]/40"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[#0b0f19]">
                            {proj?.name || "Project"}
                          </span>
                          <span className="font-mono text-xs text-[#525b6c]">
                            #{dep.deployment_number}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#525b6c]">
                          {dep.git_branch || "main"} · {formatDuration(dep.build_duration_ms)} ·{" "}
                          {formatRelativeTime(dep.created_at)}
                        </p>
                      </div>
                      <DeploymentStatusBadge status={dep.status} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Services */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Services</CardTitle>
          <CardDescription>
            Quick access to domains ({domains?.length ?? 0}), GitHub accounts (
            {githubConnections?.length ?? 0}), and monitoring ({monitorList.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/domains"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f8f9fb] p-3.5 transition-colors hover:border-[#1d5bff]/40"
          >
            <Globe className="h-5 w-5 text-[#1d5bff]" />
            <div>
              <p className="text-sm font-medium text-[#0b0f19]">Custom Domains</p>
              <p className="text-xs text-[#525b6c]">
                {(domains ?? []).filter((d) => d.verification_status === "verified").length} verified /{" "}
                {domains?.length ?? 0} total
              </p>
            </div>
          </Link>

          <Link
            href="/monitoring"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f8f9fb] p-3.5 transition-colors hover:border-[#1d5bff]/40"
          >
            <Activity className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-[#0b0f19]">Availability Probes</p>
              <p className="text-xs text-[#525b6c]">
                Run live HTTP checks and latency inspection
              </p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f8f9fb] p-3.5 transition-colors hover:border-[#1d5bff]/40"
          >
            <GitBranch className="h-5 w-5 text-[#1d5bff]" />
            <div>
              <p className="text-sm font-medium text-[#0b0f19]">GitHub &amp; AI Settings</p>
              <p className="text-xs text-[#525b6c]">
                Manage repository tokens &amp; LLM credentials
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
