import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServerSupabaseServiceKey } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { readArtifactAsset } from "@/lib/storage/artifacts";
import type { StorageProviderType } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ deploymentId: string; path?: string[] }> }
) {
  const { deploymentId, path: pathSegments } = await context.params;

  let deployment: {
    id: string;
    status: string;
    artifact_storage_provider: string | null;
    artifact_key: string | null;
  } | null = null;

  if (getServerSupabaseServiceKey()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("deployments")
      .select("id, status, artifact_storage_provider, artifact_key")
      .eq("id", deploymentId)
      .maybeSingle();
    deployment = data;
  } else {
    const { supabase, user } = await getAuthenticatedUser();
    if (user) {
      const { data } = await supabase
        .from("deployments")
        .select("id, status, artifact_storage_provider, artifact_key")
        .eq("id", deploymentId)
        .eq("user_id", user.id)
        .maybeSingle();
      deployment = data;
    }
  }

  if (
    !deployment ||
    deployment.status !== "ready" ||
    !deployment.artifact_key ||
    !deployment.artifact_storage_provider
  ) {
    return new NextResponse("Deployment preview not available", { status: 404 });
  }

  const asset = await readArtifactAsset(
    deployment.artifact_storage_provider as StorageProviderType,
    deployment.artifact_key,
    pathSegments
  );

  if (!asset) {
    return new NextResponse("Asset not found in deployment artifact", { status: 404 });
  }

  return new NextResponse(Buffer.from(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-QuantumHost-Deployment": deployment.id,
    },
  });
}
