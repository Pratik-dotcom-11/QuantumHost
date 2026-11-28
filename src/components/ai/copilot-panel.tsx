"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  KeyRound,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AiCopilotOutput } from "@/lib/ai/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ProjectChoice {
  id: string;
  name: string;
}

interface DeploymentChoice {
  id: string;
  deployment_number: number;
  status: string;
  project_id: string;
}

const QUICK_PROMPTS = [
  "Explain any build errors and the exact root cause in this deployment.",
  "Summarize the deployment logs and identify likely configuration problems.",
  "Suggest safe corrective actions for this project without modifying files automatically.",
  "Explain my current workspace infrastructure usage (build minutes, storage, bandwidth).",
];

export function CopilotPanel({
  configured,
  enabled = true,
  provider = "gemini",
  model = "gemini-2.5-flash",
  projects = [],
  deployments = [],
  fixedProjectId,
  fixedDeploymentId,
}: {
  configured: boolean;
  enabled?: boolean;
  provider?: string;
  model?: string;
  projects?: ProjectChoice[];
  deployments?: DeploymentChoice[];
  fixedProjectId?: string;
  fixedDeploymentId?: string;
}) {
  const [projectId, setProjectId] = useState(fixedProjectId ?? projects[0]?.id ?? "");
  const [deploymentId, setDeploymentId] = useState(
    fixedDeploymentId ??
      deployments.find((d) => !fixedProjectId || d.project_id === fixedProjectId)?.id ??
      ""
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiCopilotOutput | null>(null);

  const visibleDeployments = projectId
    ? deployments.filter((d) => d.project_id === projectId)
    : deployments;

  async function ask(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          projectId: fixedProjectId || projectId || null,
          deploymentId: fixedDeploymentId || deploymentId || null,
        }),
      });
      const json = (await res.json()) as {
        response?: AiCopilotOutput;
        error?: string;
      };
      if (!res.ok || !json.response) {
        throw new Error(json.error || "Deployment Copilot request failed");
      }
      setResult(json.response);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to query Copilot");
    } finally {
      setLoading(false);
    }
  }

  if (!configured || !enabled) {
    return (
      <Card className="border-[#d49b4b]/35 bg-[#14100c]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base text-[#f4ba4a]">
              <KeyRound className="h-4 w-4" />
              Deployment Copilot Setup Required
            </CardTitle>
            <Badge variant="warning">
              {!enabled ? "Disabled in Settings" : "No AI Credentials"}
            </Badge>
          </div>
          <CardDescription>
            {!enabled
              ? "AI diagnostics and Copilot are disabled in your Account Settings."
              : "No server or user AI API key is configured. Add your Google Gemini, OpenAI, or Anthropic API key in Account Settings to enable real AI troubleshooting."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#9a9084]">
            Keys are stored encrypted with AES-256-GCM and never exposed to the browser.
          </p>
          <Button asChild size="sm">
            <Link href="/settings">Configure AI Provider</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#d49b4b]/35 bg-[#120e0a]">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-[#f4ba4a]">
            <Sparkles className="h-4 w-4" />
            QuantumHost Deployment Copilot
          </CardTitle>
          <CardDescription>
            Server-side troubleshooting across logs, configs, failures, and recorded usage ({provider} /{" "}
            {model}).
          </CardDescription>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
          <ShieldCheck className="h-3 w-3" />
          Read-only advisory
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fixedProjectId && !fixedDeploymentId && (projects.length > 0 || deployments.length > 0) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.length > 0 ? (
              <Select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const match = deployments.find((d) => d.project_id === e.target.value);
                  setDeploymentId(match?.id ?? "");
                }}
                aria-label="Target project"
              >
                <option value="">All Workspace Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    Project: {p.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {visibleDeployments.length > 0 ? (
              <Select
                value={deploymentId}
                onChange={(e) => setDeploymentId(e.target.value)}
                aria-label="Target deployment"
              >
                <option value="">No specific deployment</option>
                {visibleDeployments.map((d) => (
                  <option key={d.id} value={d.id}>
                    Deployment #{d.deployment_number} ({d.status})
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((promptText, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => ask(promptText)}
              className="text-xs"
            >
              {(promptText.split(" and ")[0] ?? promptText).slice(0, 42)}
            </Button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Ask about build errors, deployment logs, config issues, or infrastructure usage..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || question.trim().length < 3} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </Button>
        </form>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded-xl border border-[#2a2118] bg-[#0c0907] p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9a9084]">
              <span className="font-mono">
                {result.provider} / {result.model}
              </span>
              {result.tokensUsed > 0 ? (
                <span className="font-mono">{result.tokensUsed.toLocaleString()} tokens</span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-[#f7f3ec]">{result.answer}</p>

            {result.keyFindings.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9084]">
                  Key Findings
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[#e7dfd3]">
                  {result.keyFindings.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.recommendedActions.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9a9084]">
                  Suggested Actions (Requires Explicit Authorization)
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[#edd19a]">
                  {result.recommendedActions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="border-t border-[#221c16] pt-2 text-[11px] text-[#9a9084]">
              {result.authorizationNotice}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
