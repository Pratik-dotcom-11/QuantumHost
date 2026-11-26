import { NextResponse } from "next/server";
import { createPublicServerClient, createAdminClient } from "@/lib/supabase/admin";
import { getServerSupabaseServiceKey } from "@/lib/env";
import { readArtifactAsset } from "@/lib/storage/artifacts";
import type { StorageProviderType } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const { slug, path: pathSegments } = await context.params;
  const supabase = createPublicServerClient();

  const { data: route, error } = await supabase
    .from("published_routes")
    .select("project_id, active_deployment_id, artifact_storage_provider, artifact_key")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !route || !route.active_deployment_id || !route.artifact_key || !route.artifact_storage_provider) {
    return new NextResponse(
      `<!doctype html><html><body style="font-family:sans-serif;background:#080a0f;color:#e2e8f0;padding:48px;text-align:center"><h1>404 — Deployment Not Found</h1><p>No active QuantumHost deployment is published for <strong>${slug}</strong>.</p></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const asset = await readArtifactAsset(
    route.artifact_storage_provider as StorageProviderType,
    route.artifact_key,
    pathSegments
  );

  if (!asset) {
    return new NextResponse("Asset not found", { status: 404 });
  }

  // Record bandwidth/request telemetry asynchronously when service role key is configured
  if (getServerSupabaseServiceKey()) {
    try {
      const admin = createAdminClient();
      const { data: proj } = await admin
        .from("projects")
        .select("user_id")
        .eq("id", route.project_id)
        .maybeSingle();

      if (proj) {
        void admin.from("resource_usage_events").insert([
          {
            user_id: proj.user_id,
            project_id: route.project_id,
            deployment_id: route.active_deployment_id,
            metric_type: "http_request",
            value: 1,
            metadata: { path: asset.resolvedPath },
          },
          {
            user_id: proj.user_id,
            project_id: route.project_id,
            deployment_id: route.active_deployment_id,
            metric_type: "bandwidth_bytes",
            value: asset.bytes.byteLength,
            metadata: { path: asset.resolvedPath },
          },
        ]);
      }
    } catch {
      // Never block live site serving on telemetry write errors
    }
  }

  const isHtml = asset.contentType.startsWith("text/html");
  return new NextResponse(Buffer.from(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": isHtml ? "public, max-age=0, must-revalidate" : "public, max-age=31536000, immutable",
      "X-QuantumHost-Deployment": route.active_deployment_id,
    },
  });
}
