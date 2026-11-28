"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/utils";
import { DeploymentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export interface TimelineDeploymentItem {
  id: string;
  deployment_number: number;
  status: string;
  environment: string;
  trigger_source: string;
  git_branch: string | null;
  git_commit_sha: string | null;
  git_commit_message: string | null;
  artifact_size_bytes: number;
  build_duration_ms: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  error_summary?: string | null;
  preview_url: string | null;
  created_at: string;
}

function formatIsoClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DeploymentTimeline({
  deployments,
  defaultBranch,
  activeDeploymentId,
  rollingBackId,
  onRollback,
}: {
  deployments: TimelineDeploymentItem[];
  defaultBranch: string;
  activeDeploymentId: string | null;
  rollingBackId: string | null;
  onRollback: (deploymentId: string) => void;
}) {
  if (deployments.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No deployments yet. Run Deploy Intelligence or click <strong>Deploy Now</strong> to enqueue your first build.
      </p>
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-px before:bg-[#2a221b]">
      {deployments.map((dep) => {
        const isActive = activeDeploymentId === dep.id;
        const shortSha = dep.git_commit_sha ? dep.git_commit_sha.slice(0, 7) : null;
        const dotColor = isActive
          ? "border-[#f4ba4a] bg-[#f4ba4a] shadow-[0_0_10px_rgba(244,186,74,0.6)]"
          : dep.status === "ready"
          ? "border-emerald-400 bg-emerald-400"
          : dep.status === "failed"
          ? "border-rose-400 bg-rose-400"
          : dep.status === "cancelled"
          ? "border-zinc-500 bg-zinc-500"
          : "border-[#f4ba4a] bg-[#1a140d]";

        return (
          <div key={dep.id} className="relative">
            <span
              className={`absolute -left-5 top-5 h-3 w-3 rounded-full border-2 ${dotColor}`}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-3 rounded-xl border border-[#26201a] bg-[#0f0c0a] p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/deployments/${dep.id}`}
                    className="font-mono text-sm font-semibold text-[#f7f3ec] hover:text-[#f4ba4a]"
                  >
                    #{dep.deployment_number}
                  </Link>
                  <DeploymentStatusBadge status={dep.status} />
                  {isActive ? (
                    <span className="rounded-full border border-[#d49b4b]/45 bg-[#2a1d0e]/85 px-2.5 py-0.5 text-[11px] font-medium text-[#f4ba4a]">
                      Current Production
                    </span>
                  ) : null}
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {dep.environment}
                  </span>
                </div>

                <p className="truncate text-sm text-[#e7dfd3]">
                  {dep.git_commit_message || `Triggered via ${dep.trigger_source}`}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[#9a9084]">
                  <span className="inline-flex items-center gap-1 text-[#d7cfc3]">
                    <GitBranch className="h-3 w-3 text-[#f4ba4a]" />
                    {dep.git_branch || defaultBranch}
                  </span>
                  {shortSha ? (
                    <span className="inline-flex items-center gap-1" title={dep.git_commit_sha ?? undefined}>
                      <GitCommitHorizontal className="h-3 w-3 text-[#f4ba4a]" />
                      {shortSha}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Start: {formatIsoClock(dep.started_at || dep.created_at)} · End:{" "}
                    {formatIsoClock(dep.finished_at)} · Duration:{" "}
                    {formatDuration(dep.build_duration_ms)}
                  </span>
                  <span>{formatBytes(dep.artifact_size_bytes)}</span>
                  <span>{formatRelativeTime(dep.created_at)}</span>
                </div>

                {dep.error_summary ? (
                  <p className="truncate font-mono text-[11px] text-rose-300">
                    Error: {dep.error_summary}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/deployments/${dep.id}`}>
                    <Terminal className="h-3.5 w-3.5" />
                    Logs
                  </Link>
                </Button>
                {dep.status === "ready" ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/d/${dep.id}`} target="_blank">
                      Preview
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
                {dep.status === "ready" && !isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRollback(dep.id)}
                    disabled={rollingBackId === dep.id}
                  >
                    {rollingBackId === dep.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Rollback
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
