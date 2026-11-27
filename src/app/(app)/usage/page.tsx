import { Clock, Cpu, Database, Globe, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { formatBytes } from "@/lib/utils";
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
    supabase.from("deployments").select("id, project_id, status").eq("user_id", user.id),
  ]);

  let buildSeconds = 0;
  let storageBytes = 0;
  let bandwidthBytes = 0;
  let httpRequests = 0;
  let aiTokens = 0;

  const projectRows = new Map(
    (projects ?? []).map((p) => [
      p.id,
      {
        name: p.name,
        slug: p.slug,
        deployments: 0,
        buildSeconds: 0,
        storageBytes: 0,
        bandwidthBytes: 0,
        httpRequests: 0,
      },
    ])
  );

  for (const d of deployments ?? []) {
    const row = projectRows.get(d.project_id);
    if (row) row.deployments += 1;
  }

  for (const ev of events ?? []) {
    const val = Number(ev.value) || 0;
    const row = ev.project_id ? projectRows.get(ev.project_id) : undefined;
    switch (ev.metric_type) {
      case "build_seconds":
        buildSeconds += val;
        if (row) row.buildSeconds += val;
        break;
      case "storage_bytes":
        storageBytes += val;
        if (row) row.storageBytes += val;
        break;
      case "bandwidth_bytes":
        bandwidthBytes += val;
        if (row) row.bandwidthBytes += val;
        break;
      case "http_request":
        httpRequests += val;
        if (row) row.httpRequests += val;
        break;
      case "ai_tokens":
        aiTokens += val;
        break;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
          Resource Consumption
        </h1>
        <p className="mt-1 text-sm text-[#9a9084]">
          Real build compute, artifact storage, served bandwidth, HTTP traffic, and AI diagnostics usage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Build Compute</CardDescription>
            <Clock className="h-4 w-4 text-[#f4ba4a]" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-[#f7f3ec]">{buildSeconds.toFixed(1)}s</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Artifact Storage</CardDescription>
            <Database className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-[#f7f3ec]">{formatBytes(storageBytes)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Bandwidth Served</CardDescription>
            <Globe className="h-4 w-4 text-[#f4ba4a]" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-[#f7f3ec]">{formatBytes(bandwidthBytes)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>HTTP Requests</CardDescription>
            <Cpu className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-[#f7f3ec]">{httpRequests.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>AI Tokens</CardDescription>
            <Sparkles className="h-4 w-4 text-[#f4ba4a]" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-[#f7f3ec]">{aiTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by Project</CardTitle>
          <CardDescription>Aggregated telemetry from worker builds and site serving</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {projectRows.size === 0 ? (
            <p className="py-4 text-sm text-[#9a9084]">No projects created yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#26201a] text-xs uppercase text-[#9a9084]">
                <tr>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Deployments</th>
                  <th className="pb-3 pr-4">Build Time</th>
                  <th className="pb-3 pr-4">Artifacts Stored</th>
                  <th className="pb-3 pr-4">Bandwidth</th>
                  <th className="pb-3">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#221c16] font-mono text-xs">
                {Array.from(projectRows.values()).map((row) => (
                  <tr key={row.slug} className="hover:bg-[#191410]">
                    <td className="py-3 pr-4 font-sans text-sm font-medium text-[#f7f3ec]">
                      {row.name}
                    </td>
                    <td className="py-3 pr-4 text-[#d7cfc3]">{row.deployments}</td>
                    <td className="py-3 pr-4 text-[#d7cfc3]">{row.buildSeconds.toFixed(1)}s</td>
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
    </div>
  );
}
