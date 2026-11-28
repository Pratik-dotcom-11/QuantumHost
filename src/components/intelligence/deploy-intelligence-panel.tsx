"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  KeyRound,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { DeployIntelligenceReport } from "@/lib/intelligence/deploy-analyzer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DeployIntelligencePanel({
  report,
  onApplyRecommended,
  applying = false,
}: {
  report: DeployIntelligenceReport;
  onApplyRecommended?: (config: DeployIntelligenceReport["recommendedConfig"]) => void;
  applying?: boolean;
}) {
  const readinessVariant =
    report.readiness === "ready"
      ? "success"
      : report.readiness === "warnings"
      ? "warning"
      : "destructive";

  const readinessLabel =
    report.readiness === "ready"
      ? "Ready to Deploy"
      : report.readiness === "warnings"
      ? "Warnings Detected"
      : "Blocked — Action Required";

  return (
    <Card className="border-[#d49b4b]/35 bg-[#120e0a]">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[#f4ba4a]" />
              Deploy Intelligence Report
            </CardTitle>
            <Badge variant={readinessVariant}>{readinessLabel}</Badge>
          </div>
          <CardDescription className="mt-1">
            Detected preset: <span className="font-mono text-[#f7f3ec]">{report.detectedFramework}</span>
            {report.detectedPackageName ? ` (${report.detectedPackageName})` : ""}
          </CardDescription>
        </div>
        {onApplyRecommended ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={applying}
            onClick={() => onApplyRecommended(report.recommendedConfig)}
          >
            <Wrench className="h-3.5 w-3.5" />
            Apply Recommended Config
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {report.findings.map((finding) => (
            <div
              key={finding.id}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                finding.severity === "blocker"
                  ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
                  : finding.severity === "warning"
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
                  : "border-emerald-500/25 bg-emerald-500/8 text-emerald-200"
              }`}
            >
              {finding.severity === "blocker" ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              ) : finding.severity === "warning" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-[#f7f3ec]">{finding.title}</p>
                <p className="text-[#d7cfc3]">{finding.detail}</p>
                {finding.suggestion ? (
                  <p className="font-mono text-[11px] text-[#f4ba4a]">
                    Recommendation: {finding.suggestion}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#26201a] bg-[#0d0a08] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a9084]">
              <Cpu className="h-3.5 w-3.5 text-[#f4ba4a]" />
              Recommended Configuration
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
              <div>
                <dt className="text-[#9a9084]">Framework</dt>
                <dd className="text-[#f7f3ec]">{report.recommendedConfig.framework}</dd>
              </div>
              <div>
                <dt className="text-[#9a9084]">Node.js</dt>
                <dd className="text-[#f7f3ec]">Node {report.recommendedConfig.nodeVersion}</dd>
              </div>
              <div>
                <dt className="text-[#9a9084]">Install</dt>
                <dd className="truncate text-[#f7f3ec]">
                  {report.recommendedConfig.installCommand || "(none)"}
                </dd>
              </div>
              <div>
                <dt className="text-[#9a9084]">Build</dt>
                <dd className="truncate text-[#f7f3ec]">
                  {report.recommendedConfig.buildCommand || "(none)"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#9a9084]">Output Directory</dt>
                <dd className="text-[#f7f3ec]">{report.recommendedConfig.outputDirectory}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-[#26201a] bg-[#0d0a08] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a9084]">
              <KeyRound className="h-3.5 w-3.5 text-[#f4ba4a]" />
              Detected Environment Variable Names
            </p>
            {report.requiredEnvVars.length === 0 ? (
              <p className="mt-2 text-xs text-[#9a9084]">
                No required variable names found in .env.example.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 font-mono text-xs">
                {report.requiredEnvVars.map((envVar) => (
                  <li key={envVar.key} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[#f7f3ec]">{envVar.key}</span>
                    <Badge variant={envVar.configured ? "success" : "warning"}>
                      {envVar.configured ? "Configured" : "Missing"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-[11px] text-[#9a9084]">{report.disclaimer}</p>
      </CardContent>
    </Card>
  );
}
