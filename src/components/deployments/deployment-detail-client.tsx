"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Ban,
  Loader2,
  RotateCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/utils";
import { DeploymentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface LogEntry {
  id: number;
  seq: number;
  level: string;
  stage: string;
  message: string;
  created_at: string;
}

interface AiDiagnosis {
  summary: string;
  rootCause: string;
  suggestedFixes: string[];
  confidence: string;
  provider: string;
  model: string;
}

interface DeploymentDetail {
  id: string;
  project_id: string;
  deployment_number: number;
  status: string;
  environment: string;
  trigger_source: string;
  git_branch: string | null;
  git_commit_sha: string | null;
  git_commit_message: string | null;
  artifact_storage_provider: string | null;
  artifact_size_bytes: number;
  build_duration_ms: number | null;
  error_summary: string | null;
  ai_diagnosis: AiDiagnosis | null;
  created_at: string;
}

export function DeploymentDetailClient({
  initialDeployment,
  initialLogs,
  projectName,
  projectSlug,
  isCurrentProduction,
}: {
  initialDeployment: DeploymentDetail;
  initialLogs: LogEntry[];
  projectName: string;
  projectSlug: string;
  isCurrentProduction: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deployment, setDeployment] = useState<DeploymentDetail>(initialDeployment);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [diagnosing, setDiagnosing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isInProgress = ["queued", "building", "uploading"].includes(deployment.status);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`deployment-${deployment.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deployment_logs",
          filter: `deployment_id=eq.${deployment.id}`,
        },
        (payload) => {
          const row = payload.new as LogEntry;
          setLogs((prev) =>
            prev.some((l) => l.seq === row.seq)
              ? prev
              : [...prev, row].sort((a, b) => a.seq - b.seq)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deployments",
          filter: `id=eq.${deployment.id}`,
        },
        (payload) => {
          setDeployment(payload.new as DeploymentDetail);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deployment.id]);

  // Polling fallback while build is active
  useEffect(() => {
    if (!isInProgress) return;
    const timer = setInterval(async () => {
      const lastSeq = logs.length > 0 ? logs[logs.length - 1]?.seq ?? 0 : 0;
      const res = await fetch(`/api/deployments/${deployment.id}?afterSeq=${lastSeq}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        deployment?: DeploymentDetail;
        logs?: LogEntry[];
      };
      if (json.deployment) setDeployment(json.deployment);
      if (json.logs?.length) {
        setLogs((prev) => {
          const existing = new Set(prev.map((l) => l.seq));
          const merged = [...prev];
          for (const item of json.logs!) {
            if (!existing.has(item.seq)) merged.push(item);
          }
          return merged.sort((a, b) => a.seq - b.seq);
        });
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [deployment.id, isInProgress, logs]);

  async function handleDiagnose() {
    setActionError(null);
    setDiagnosing(true);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId: deployment.id }),
      });
      const json = (await res.json()) as { diagnosis?: AiDiagnosis; error?: string };
      if (!res.ok || !json.diagnosis) {
        throw new Error(json.error || "AI diagnosis failed");
      }
      setDeployment((prev) => ({ ...prev, ai_diagnosis: json.diagnosis! }));
      toast({ title: "AI diagnosis ready", variant: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI diagnosis failed";
      toast({ title: "AI diagnosis failed", description: msg, variant: "error" });
      setActionError(msg);
    } finally {
      setDiagnosing(false);
    }
  }

  async function handleRollback() {
    setActionError(null);
    setRollingBack(true);
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/rollback`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Rollback failed");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setRollingBack(false);
    }
  }

  async function handleCancel() {
    setActionError(null);
    setCancelling(true);
    try {
      const res = await fetch(`/api/deployments/${deployment.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "Unable to cancel deployment");
      }
      setDeployment((prev) => ({ ...prev, status: "cancelled" }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/projects/${deployment.project_id}`}
              className="text-sm text-[#9a9084] hover:text-[#f4ba4a]"
            >
              {projectName}
            </Link>
            <span className="text-[#5e564d]">/</span>
            <h1 className="font-mono text-2xl font-bold text-[#f7f3ec]">
              #{deployment.deployment_number}
            </h1>
            <DeploymentStatusBadge status={deployment.status} />
            {isCurrentProduction ? (
              <span className="rounded-full border border-[#d49b4b]/40 bg-[#2a1d0e]/75 px-2.5 py-0.5 text-xs font-medium text-[#f4ba4a]">
                Active Production
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[#9a9084]">
            Branch <span className="font-mono text-[#d7cfc3]">{deployment.git_branch || "main"}</span>{" "}
            · {deployment.trigger_source} · created {formatRelativeTime(deployment.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isInProgress ? (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Cancel
            </Button>
          ) : null}

          {deployment.status === "ready" ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/d/${deployment.id}`} target="_blank">
                  Open Artifact URL
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/sites/${projectSlug}`} target="_blank">
                  Live Site
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              {!isCurrentProduction ? (
                <Button size="sm" onClick={handleRollback} disabled={rollingBack}>
                  {rollingBack ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Promote / Rollback Here
                </Button>
              ) : null}
            </>
          ) : null}

          {deployment.status === "failed" ? (
            <Button size="sm" onClick={handleDiagnose} disabled={diagnosing}>
              {diagnosing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze Failure with AI
            </Button>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {/* Metadata Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Environment</CardDescription>
            <CardTitle className="font-mono text-base">{deployment.environment}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Build Duration</CardDescription>
            <CardTitle className="font-mono text-base">
              {formatDuration(deployment.build_duration_ms)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Artifact Size</CardDescription>
            <CardTitle className="font-mono text-base">
              {formatBytes(deployment.artifact_size_bytes)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Storage Provider</CardDescription>
            <CardTitle className="font-mono text-base">
              {deployment.artifact_storage_provider || "pending"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* AI Diagnosis Panel */}
      {deployment.ai_diagnosis ? (
        <Card className="border-[#d49b4b]/40 bg-[#1a140d]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-[#f4ba4a]">
                <Sparkles className="h-4 w-4" />
                AI Build Failure Diagnosis
              </CardTitle>
              <span className="font-mono text-xs text-[#9a9084]">
                {deployment.ai_diagnosis.provider} / {deployment.ai_diagnosis.model} · confidence:{" "}
                {deployment.ai_diagnosis.confidence}
              </span>
            </div>
            <CardDescription>{deployment.ai_diagnosis.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9084]">
                Root Cause
              </p>
              <p className="mt-1 text-[#f7f3ec]">{deployment.ai_diagnosis.rootCause}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9084]">
                Suggested Fixes
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[#e7dfd3]">
                {deployment.ai_diagnosis.suggestedFixes.map((fix, idx) => (
                  <li key={idx}>{fix}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Build Logs Terminal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#26201a] pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#f4ba4a]" />
            <CardTitle>Build Logs</CardTitle>
          </div>
          {isInProgress ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#f4ba4a]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Streaming live output...
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-hidden rounded-b-2xl bg-[#090706] p-0">
          {deployment.error_summary ? (
            <div className="border-b border-rose-500/30 bg-rose-500/15 px-4 py-2.5 font-mono text-xs text-rose-300">
              Error: {deployment.error_summary}
            </div>
          ) : null}
          <div className="max-h-[480px] overflow-y-auto p-4 font-mono text-xs leading-6">
            {logs.length === 0 ? (
              <p className="text-[#9a9084]">Waiting for worker log stream...</p>
            ) : (
              logs.map((entry) => {
                const colorClass =
                  entry.level === "error"
                    ? "text-rose-400"
                    : entry.level === "warn"
                    ? "text-amber-300"
                    : entry.level === "system"
                    ? "text-[#f4ba4a]"
                    : "text-[#e7dfd3]";

                return (
                  <div key={entry.id || entry.seq} className="flex gap-3">
                    <span className="w-16 shrink-0 text-[#6e665c]">[{entry.stage}]</span>
                    <span className={`whitespace-pre-wrap break-all ${colorClass}`}>
                      {entry.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
