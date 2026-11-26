import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const [{ data: events }, { data: projects }, { data: deployments }] = await Promise.all([
    supabase
      .from("resource_usage_events")
      .select("project_id, metric_type, value, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1000),
    supabase.from("projects").select("id, name, slug").eq("user_id", user.id),
    supabase
      .from("deployments")
      .select("id, project_id, status, artifact_size_bytes, build_duration_ms")
      .eq("user_id", user.id),
  ]);

  const totals = {
    buildSeconds: 0,
    storageBytes: 0,
    bandwidthBytes: 0,
    httpRequests: 0,
    aiTokens: 0,
  };

  const byProject = new Map<
    string,
    {
      projectId: string;
      name: string;
      slug: string;
      buildSeconds: number;
      storageBytes: number;
      bandwidthBytes: number;
      httpRequests: number;
      deployments: number;
    }
  >();

  for (const p of projects ?? []) {
    byProject.set(p.id, {
      projectId: p.id,
      name: p.name,
      slug: p.slug,
      buildSeconds: 0,
      storageBytes: 0,
      bandwidthBytes: 0,
      httpRequests: 0,
      deployments: 0,
    });
  }

  for (const dep of deployments ?? []) {
    const entry = byProject.get(dep.project_id);
    if (entry) {
      entry.deployments += 1;
    }
  }

  for (const ev of events ?? []) {
    const val = Number(ev.value) || 0;
    const entry = ev.project_id ? byProject.get(ev.project_id) : undefined;
    switch (ev.metric_type) {
      case "build_seconds":
        totals.buildSeconds += val;
        if (entry) entry.buildSeconds += val;
        break;
      case "storage_bytes":
        totals.storageBytes += val;
        if (entry) entry.storageBytes += val;
        break;
      case "bandwidth_bytes":
        totals.bandwidthBytes += val;
        if (entry) entry.bandwidthBytes += val;
        break;
      case "http_request":
        totals.httpRequests += val;
        if (entry) entry.httpRequests += val;
        break;
      case "ai_tokens":
        totals.aiTokens += val;
        break;
    }
  }

  return NextResponse.json({
    totals,
    projects: Array.from(byProject.values()),
    deploymentCount: deployments?.length ?? 0,
  });
}
