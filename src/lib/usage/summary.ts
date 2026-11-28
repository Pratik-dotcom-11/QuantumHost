export interface UsageSummaryInput {
  projects: Array<{ id: string; name: string; slug: string }>;
  deployments: Array<{
    id: string;
    project_id: string;
    status: string;
    artifact_size_bytes: number;
    build_duration_ms: number | null;
  }>;
  events: Array<{
    project_id: string | null;
    metric_type: string;
    value: number | string;
  }>;
  hostingProvider: string;
  storageProvider: string;
}

export interface ProjectUsageBreakdown {
  projectId: string;
  name: string;
  slug: string;
  deployments: number;
  readyDeployments: number;
  failedDeployments: number;
  buildSeconds: number;
  buildMinutes: number;
  storageBytes: number;
  bandwidthBytes: number;
  httpRequests: number;
}

export interface UsageTransparencySummary {
  totals: {
    buildSeconds: number;
    buildMinutes: number;
    storageBytes: number;
    currentStoredBytes: number;
    bandwidthBytes: number;
    httpRequests: number;
    aiTokens: number;
  };
  deploymentCounts: {
    total: number;
    ready: number;
    failed: number;
    other: number;
  };
  projects: ProjectUsageBreakdown[];
  measurementNotes: {
    buildCompute: string;
    storage: string;
    bandwidth: string;
    requests: string;
  };
}

export function buildUsageSummary(input: UsageSummaryInput): UsageTransparencySummary {
  const totals = {
    buildSeconds: 0,
    buildMinutes: 0,
    storageBytes: 0,
    currentStoredBytes: 0,
    bandwidthBytes: 0,
    httpRequests: 0,
    aiTokens: 0,
  };

  const deploymentCounts = {
    total: input.deployments.length,
    ready: 0,
    failed: 0,
    other: 0,
  };

  const byProject = new Map<string, ProjectUsageBreakdown>();
  for (const p of input.projects) {
    byProject.set(p.id, {
      projectId: p.id,
      name: p.name,
      slug: p.slug,
      deployments: 0,
      readyDeployments: 0,
      failedDeployments: 0,
      buildSeconds: 0,
      buildMinutes: 0,
      storageBytes: 0,
      bandwidthBytes: 0,
      httpRequests: 0,
    });
  }

  for (const dep of input.deployments) {
    if (dep.status === "ready") {
      deploymentCounts.ready += 1;
      totals.currentStoredBytes += Number(dep.artifact_size_bytes) || 0;
    } else if (dep.status === "failed") {
      deploymentCounts.failed += 1;
    } else {
      deploymentCounts.other += 1;
    }

    const entry = byProject.get(dep.project_id);
    if (entry) {
      entry.deployments += 1;
      if (dep.status === "ready") entry.readyDeployments += 1;
      if (dep.status === "failed") entry.failedDeployments += 1;
    }
  }

  for (const ev of input.events) {
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

  totals.buildMinutes = Number((totals.buildSeconds / 60).toFixed(2));
  for (const entry of byProject.values()) {
    entry.buildMinutes = Number((entry.buildSeconds / 60).toFixed(2));
  }

  const bandwidthNote =
    input.hostingProvider === "cloudflare-saas"
      ? "Origin-served bytes metered via /sites/[slug]; external CDN edge cache hits require Cloudflare GraphQL Analytics (not synthesized)."
      : "Actual HTTP response bytes served through QuantumHost /sites/[slug] edge route.";

  return {
    totals,
    deploymentCounts,
    projects: Array.from(byProject.values()),
    measurementNotes: {
      buildCompute: "Exact execution duration emitted by BullMQ build worker after job completion.",
      storage: `Verified uploaded bundle size via configured "${input.storageProvider}" storage adapter.`,
      bandwidth: bandwidthNote,
      requests: "Actual HTTP GET requests logged by /sites/[slug] route handler.",
    },
  };
}
