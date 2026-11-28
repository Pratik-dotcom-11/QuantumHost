import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { buildUsageSummary } from "@/lib/usage/summary";

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const [{ data: events }, { data: projects }, { data: deployments }] = await Promise.all([
    supabase
      .from("resource_usage_events")
      .select("project_id, metric_type, value, recorded_at")
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

  return NextResponse.json(summary);
}
