import Link from "next/link";
import { Clock, Cpu, Database, Globe, Info, Rocket, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { buildUsageSummary } from "@/lib/usage/summary";
import { formatBytes } from "@/lib/utils";
import {
  AnimatedCounter,
  SpotlightCard,
  StaggerGroup,
  StaggerItem,
} from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: events }, { data: projects }, { data: deployments }] = await Promise.all([
    supabase
      .from("resource_usage_events")
      .select("project_id, metric_type, value")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(2000),
    supabase.from("projects").select("id, name, slug").eq("user_id", user.id),
    supabase
      .from("deployments")
      .select("id, project_id, status, artifact_size_bytes, build_duration_ms")
      .eq("user_id", user.id),
  ]);

  const summary = buildUsageSummary({
    projects: projects ?? [],
    deployments: deployments ?? [],
    events: events ?? [],
    hostingProvider: process.env.HOSTING_PROVIDER?.trim() || "quantumhost-edge",
    storageProvider: process.env.ARTIFACT_STORAGE_PROVIDER?.trim() || "local",
  });

  const { totals, deploymentCounts, projects: projectRows, measurementNotes } = summary;
  const maxProjectStorage = Math.max(...projectRows.map((r) => r.storageBytes), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
            Resource Transparency
          </h1>
          <p className="mt-1 text-sm text-[#9a9084]">
            Verified measurements from build workers, object storage uploads, and origin site delivery — zero fabricated numbers.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/copilot">
            <Sparkles className="h-4 w-4 text-[#f4ba4a]" />
            Explain Usage with Copilot
          </Link>
        </Button>
      </div>

      <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" viewport={false} stagger={0.055}>
        <StaggerItem>
          <SpotlightCard className="h-full">
            <Card className="h-full border-0 bg-transparent shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Build Minutes</CardDescription>
                <Clock className="h-4 w-4 text-[#f4ba4a]" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-xl font-bold text-[#f7f3ec]">
                  <AnimatedCounter value={totals.buildMinutes} decimals={2} suffix="m" />
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#9a9084]">
                  {totals.buildSeconds.toFixed(1)}s measured
                </p>
              </CardContent>
            </Card>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <Card className="h-full border-0 bg-transparent shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Artifact Storage</CardDescription>
                <Database className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-xl font-bold text-[#f7f3ec]">
                  {formatBytes(totals.currentStoredBytes || totals.storageBytes)}
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#9a9084]">
                  {formatBytes(totals.storageBytes)} cumulative uploaded
                </p>
              </CardContent>
            </Card>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <Card className="h-full border-0 bg-transparent shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Origin Bandwidth</CardDescription>
                <Globe className="h-4 w-4 text-[#f4ba4a]" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-xl font-bold text-[#f7f3ec]">
                  {formatBytes(totals.bandwidthBytes)}
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#9a9084]">
                  {totals.httpRequests.toLocaleString()} served requests
                </p>
              </CardContent>
            </Card>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <Card className="h-full border-0 bg-transparent shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Deployments</CardDescription>
                <Rocket className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-xl font-bold text-[#f7f3ec]">
                  <AnimatedCounter value={deploymentCounts.total} locale />
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#9a9084]">
                  {deploymentCounts.ready} ready · {deploymentCounts.failed} failed
                </p>
              </CardContent>
            </Card>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <Card className="h-full border-0 bg-transparent shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>AI Copilot Tokens</CardDescription>
                <Cpu className="h-4 w-4 text-[#f4ba4a]" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-xl font-bold text-[#f7f3ec]">
                  <AnimatedCounter value={totals.aiTokens} locale />
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#9a9084]">
                  From configured LLM API
                </p>
              </CardContent>
            </Card>
          </SpotlightCard>
        </StaggerItem>
      </StaggerGroup>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by Project</CardTitle>
          <CardDescription>Per-project verified deployments, build minutes, storage, and origin traffic</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {projectRows.length === 0 ? (
            <p className="py-4 text-sm text-[#9a9084]">No projects created yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#26201a] text-xs uppercase text-[#9a9084]">
                <tr>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Deployments</th>
                  <th className="pb-3 pr-4">Build Time</th>
                  <th className="pb-3 pr-4">Artifacts Stored</th>
                  <th className="pb-3 pr-4">Origin Bandwidth</th>
                  <th className="pb-3">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#221c16] font-mono text-xs">
                {projectRows.map((row) => (
                  <tr key={row.slug} className="hover:bg-[#191410]">
                    <td className="py-3 pr-4 font-sans text-sm font-medium text-[#f7f3ec]">
                      <Link href={`/projects/${row.projectId}`} className="hover:text-[#f4ba4a]">
                        {row.name}
                      </Link>
                      <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-[#1e1812]">
                        <div
                          className="h-full bg-[#f4ba4a]"
                          style={{
                            width: `${Math.min(100, Math.round((row.storageBytes / maxProjectStorage) * 100))}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[#d7cfc3]">
                      {row.deployments} ({row.readyDeployments} ready)
                    </td>
                    <td className="py-3 pr-4 text-[#d7cfc3]">
                      {row.buildMinutes.toFixed(2)}m ({row.buildSeconds.toFixed(1)}s)
                    </td>
                    <td className="py-3 pr-4 text-[#d7cfc3]">{formatBytes(row.storageBytes)}</td>
                    <td className="py-3 pr-4 text-[#d7cfc3]">{formatBytes(row.bandwidthBytes)}</td>
                    <td className="py-3 text-[#d7cfc3]">{row.httpRequests.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-[#f4ba4a]" />
            Measurement Transparency &amp; Sources
          </CardTitle>
          <CardDescription>
            Every figure above maps directly to recorded runtime events — unavailable provider counters remain 0 rather than estimated.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3">
            <p className="font-semibold text-[#f7f3ec]">Build Minutes</p>
            <p className="mt-1 text-[#9a9084]">{measurementNotes.buildCompute}</p>
          </div>
          <div className="rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3">
            <p className="font-semibold text-[#f7f3ec]">Artifact Storage</p>
            <p className="mt-1 text-[#9a9084]">{measurementNotes.storage}</p>
          </div>
          <div className="rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3">
            <p className="font-semibold text-[#f7f3ec]">Bandwidth</p>
            <p className="mt-1 text-[#9a9084]">{measurementNotes.bandwidth}</p>
          </div>
          <div className="rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3">
            <p className="font-semibold text-[#f7f3ec]">HTTP Requests</p>
            <p className="mt-1 text-[#9a9084]">{measurementNotes.requests}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
