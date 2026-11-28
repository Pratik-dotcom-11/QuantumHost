import { isCloudflareConfigured } from "@/lib/hosting/cloudflare";
import { buildDeploymentHostingUrls } from "@/lib/hosting/urls";
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
  verifyTargetUrl: string;
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
  supportsCustomHostnameSsl: boolean;
  /**
   * Registers deployment artifact coordinates and immutable preview URL without
   * cutting over the live production pointer until verification completes.
   */
  activatePreview(input: HostingActivationInput): Promise<HostingActivationResult>;
  /**
   * Atomically switches production traffic (`projects.active_deployment_id`)
   * after deployment is verified and ready.
   */
  promoteProduction(input: {
    projectId: string;
    projectSlug: string;
    deploymentId: string;
    appUrl: string;
  }): Promise<{ activeDeploymentId: string; productionUrl: string }>;
  /**
   * Verifies stored artifact readability (`index.html`) and optionally probes live HTTP serving.
   */
  verify(input: {
    deploymentId: string;
    storageProvider: StorageProviderType;
    artifactKey: string;
    verifyUrl: string;
    strictHttp?: boolean;
  }): Promise<HostingVerificationResult>;
}

function buildEdgeAdapter(
  name: string,
  supportsCustomHostnameSsl: boolean
): HostingProviderAdapter {
  return {
    name,
    supportsCustomHostnameSsl,

    async activatePreview(input: HostingActivationInput): Promise<HostingActivationResult> {
      const admin = createAdminClient();
      const urls = buildDeploymentHostingUrls({
        appUrl: input.appUrl,
        slug: input.projectSlug,
        deploymentId: input.deploymentId,
      });

      const productionUrl = input.environment === "production" ? urls.productionUrl : null;

      await admin
        .from("deployments")
        .update({
          hosting_provider: name,
          artifact_storage_provider: input.storageProvider,
          artifact_key: input.artifactKey,
          artifact_size_bytes: input.artifactSizeBytes,
          preview_url: urls.previewUrl,
          production_url: productionUrl,
        })
        .eq("id", input.deploymentId);

      return {
        previewUrl: urls.previewUrl,
        productionUrl,
        targetUrl: productionUrl ?? urls.previewUrl,
        verifyTargetUrl: urls.fallbackPreviewUrl,
      };
    },

    async promoteProduction(input) {
      const admin = createAdminClient();
      const urls = buildDeploymentHostingUrls({
        appUrl: input.appUrl,
        slug: input.projectSlug,
        deploymentId: input.deploymentId,
      });

      const { error } = await admin
        .from("projects")
        .update({ active_deployment_id: input.deploymentId })
        .eq("id", input.projectId);

      if (error) {
        throw new Error(`Failed to promote active production deployment: ${error.message}`);
      }

      return {
        activeDeploymentId: input.deploymentId,
        productionUrl: urls.productionUrl,
      };
    },

    async verify(input): Promise<HostingVerificationResult> {
      // 1. Verify stored artifact entry point actually reads cleanly from object storage
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
}

export const quantumHostEdgeAdapter = buildEdgeAdapter("quantumhost-edge", false);
export const cloudflareSaasAdapter = buildEdgeAdapter("cloudflare-saas", true);

export function resolveHostingProviderAdapter(preferred?: string | null): HostingProviderAdapter {
  const configured = (preferred || process.env.HOSTING_PROVIDER || "").trim().toLowerCase();
  if (configured === "cloudflare" || configured === "cloudflare-saas") {
    return cloudflareSaasAdapter;
  }
  if (!configured && isCloudflareConfigured()) {
    return cloudflareSaasAdapter;
  }
  return quantumHostEdgeAdapter;
}
