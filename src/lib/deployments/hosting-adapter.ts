import { readArtifactAsset } from "@/lib/storage/artifacts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StorageProviderType } from "@/types/database";

export interface HostingActivationInput {
  deploymentId: string;
  projectId: string;
  projectSlug: string;
  environment: "production" | "preview";
  storageProvider: StorageProviderType;
  artifactKey: string;
  artifactSizeBytes: number;
  appUrl: string;
}

export interface HostingActivationResult {
  previewUrl: string;
  productionUrl: string | null;
  targetUrl: string;
}

export interface HostingVerificationResult {
  artifactReadable: boolean;
  entryPath: string | null;
  httpChecked: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
}

export interface HostingProviderAdapter {
  name: string;
  activate(input: HostingActivationInput): Promise<HostingActivationResult>;
  verify(input: {
    deploymentId: string;
    storageProvider: StorageProviderType;
    artifactKey: string;
    verifyUrl: string;
    strictHttp?: boolean;
  }): Promise<HostingVerificationResult>;
}

/**
 * Default QuantumHost static-edge adapter:
 * stores immutable artifacts via configured object storage, promotes `projects.active_deployment_id`
 * for production releases (triggering `published_routes` sync), and verifies real artifact delivery.
 */
export const quantumHostEdgeAdapter: HostingProviderAdapter = {
  name: "quantumhost-edge",

  async activate(input: HostingActivationInput): Promise<HostingActivationResult> {
    const admin = createAdminClient();
    const previewUrl = `${input.appUrl.replace(/\/$/, "")}/d/${input.deploymentId}`;
    const productionUrl =
      input.environment === "production"
        ? `${input.appUrl.replace(/\/$/, "")}/sites/${input.projectSlug}`
        : null;

    await admin
      .from("deployments")
      .update({
        artifact_storage_provider: input.storageProvider,
        artifact_key: input.artifactKey,
        artifact_size_bytes: input.artifactSizeBytes,
        preview_url: previewUrl,
      })
      .eq("id", input.deploymentId);

    if (input.environment === "production") {
      await admin
        .from("projects")
        .update({ active_deployment_id: input.deploymentId })
        .eq("id", input.projectId);
    }

    return {
      previewUrl,
      productionUrl,
      targetUrl: productionUrl ?? previewUrl,
    };
  },

  async verify(input): Promise<HostingVerificationResult> {
    // 1. Verify stored artifact entry point actually exists & reads cleanly from object storage
    const asset = await readArtifactAsset(input.storageProvider, input.artifactKey, undefined);
    if (!asset || asset.bytes.byteLength === 0) {
      throw new Error(
        `Artifact verification failed: no valid entry asset (index.html) found in "${input.artifactKey}".`
      );
    }

    // 2. Verify live HTTP serving URL when reachable
    let httpChecked = false;
    let httpStatus: number | null = null;
    let latencyMs: number | null = null;

    try {
      const start = Date.now();
      const res = await fetch(input.verifyUrl, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      latencyMs = Date.now() - start;
      httpStatus = res.status;
      httpChecked = true;

      if (res.status >= 400) {
        throw new Error(
          `Deployment URL verification failed: ${input.verifyUrl} responded with HTTP ${res.status}.`
        );
      }
    } catch (err) {
      if (input.strictHttp) {
        throw err;
      }
      // If the HTTP probe itself returned an error status (>= 400), rethrow immediately
      if (httpStatus !== null && httpStatus >= 400) {
        throw err;
      }
    }

    return {
      artifactReadable: true,
      entryPath: asset.resolvedPath,
      httpChecked,
      httpStatus,
      latencyMs,
    };
  },
};
