"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, ChevronRight, FileCode2, Sparkles, User } from "lucide-react";

interface Scenario {
  id: string;
  slug: string;
  prompt: string;
  reply: string;
  files: string[];
  previewBrand: string;
  previewNav: string[];
  previewHeading: string;
  rows: Array<{ label: string; meta: string }>;
  cta: string;
  codeSnippet: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "studio",
    slug: "edge-studio",
    prompt: "Deploy a production site with isolated builds and custom DNS.",
    reply: "Configured the build pipeline and edge routes:",
    files: ["build-worker.ts", "edge-routes.tsx"],
    previewBrand: "QUANTUM EDGE",
    previewNav: ["Overview", "Domains", "Telemetry"],
    previewHeading: "Deploy something\nthat scales.",
    rows: [
      { label: "Isolated Worker", meta: "BullMQ · 12.4s" },
      { label: "Artifact Edge", meta: "R2 · ap-south-1" },
    ],
    cta: "Launch deployment",
    codeSnippet: `// quantumhost.pipeline.ts
export const pipeline = {
  runtime: "nodejs-22",
  isolation: "bullmq-sandbox",
  storage: "cloudflare-r2",
  rollback: "atomic-pointer-swap",
  tls: "verified-custom-hostname",
};`,
  },
  {
    id: "diagnostics",
    slug: "ai-diagnostics",
    prompt: "Analyze failed build logs and suggest dependency fix.",
    reply: "Identified missing peer dependency and patch:",
    files: ["diagnostic-report.json", "package.json"],
    previewBrand: "AI DIAGNOSTICS",
    previewNav: ["Logs", "Root Cause", "Patch"],
    previewHeading: "Fix failed builds\nin seconds.",
    rows: [
      { label: "Gemini Analyzer", meta: "BYOK · Encrypted" },
      { label: "Log Streaming", meta: "Live Seq · Redacted" },
    ],
    cta: "Open diagnostics",
    codeSnippet: `// ai.diagnostics.result.json
{
  "provider": "gemini-2.5-flash",
  "rootCause": "Missing sharp native binary on linux-x64",
  "remediation": ["Pin @next/swc platform optionalDeps", "Trigger rebuild"]
}`,
  },
];

export function WorkbenchShowcase({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [promptInput, setPromptInput] = useState("");
  const scenario = SCENARIOS[scenarioIdx] ?? SCENARIOS[0]!;

  function handlePromptSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScenarioIdx((prev) => (prev === 0 ? 1 : 0));
    setPromptInput("");
  }

  return (
    <section id="workbench" className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pb-24">
      {/* Split Header matching Reference "FROM A PROMPT TO A PREVIEW / Your idea, taking shape." */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9a9084]">
            From Git Push to Production
          </p>
          <h2 className="font-display mt-2 text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec] sm:text-[34px]">
            Your deployment, taking shape.
          </h2>
        </div>
        <p className="max-w-[210px] text-xs leading-relaxed text-[#8e857b] sm:text-right">
          Push from your repository. Refine and roll back as you go.
        </p>
      </div>

      {/* Main Workbench Window Frame */}
      <div className="overflow-hidden rounded-2xl border border-[#272019] bg-[#120f0c] shadow-[0_28px_90px_rgba(0,0,0,0.7)]">
        {/* Top Window Chrome */}
        <div className="flex items-center justify-between border-b border-[#221c16] bg-[#16120e] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-display text-sm font-semibold tracking-normal text-[#f7f3ec]">
              QuantumHost
            </span>
            <span className="text-[#5e564d]">/</span>
            <span className="font-mono text-xs text-[#9a9084]">{scenario.slug}</span>
          </div>

          <div
            role="tablist"
            aria-label="Workbench view mode"
            className="inline-flex items-center rounded-full border border-[#2a231b] bg-[#0b0907] p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
              className={`rounded-full px-3.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === "preview"
                  ? "bg-[#3a3025] text-[#f7f3ec]"
                  : "text-[#8e857b] hover:text-[#f7f3ec]"
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "code"}
              onClick={() => setActiveTab("code")}
              className={`rounded-full px-3.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === "code"
                  ? "bg-[#3a3025] text-[#f7f3ec]"
                  : "text-[#8e857b] hover:text-[#f7f3ec]"
              }`}
            >
              Code
            </button>
          </div>
        </div>

        {/* Two-Pane Body */}
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-12">
          {/* Left Timeline & Prompt Pane */}
          <div className="flex flex-col justify-between gap-4 lg:col-span-5">
            <div className="space-y-4">
              {/* User Trigger Row */}
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2d261e] bg-[#1d1813] text-[#c8bfb2]">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 rounded-xl border border-[#26201a] bg-[#181410] px-3.5 py-2.5 text-xs text-[#dfd8ce]">
                  {scenario.prompt}
                </div>
              </div>

              {/* Assistant / Build Worker Response */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4ba4a] text-[11px] font-bold text-[#110d08]">
                  Q
                </div>
                <div className="flex-1 space-y-2.5 pt-0.5">
                  <p className="text-xs text-[#dfd8ce]">{scenario.reply}</p>
                  <div className="space-y-2">
                    {scenario.files.map((file) => (
                      <button
                        key={file}
                        type="button"
                        onClick={() => setActiveTab(activeTab === "preview" ? "code" : "preview")}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-[#26201a] bg-[#181410] px-3.5 py-2.5 text-left font-mono text-xs text-[#d6cfc5] transition-colors hover:border-[#d49b4b]/45 cursor-pointer"
                      >
                        <FileCode2 className="h-3.5 w-3.5 text-[#9a9084]" />
                        {file}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Prompt / Switch Input */}
            <form
              onSubmit={handlePromptSubmit}
              className="flex items-center justify-between rounded-xl border border-[#29221b] bg-[#181410] py-1.5 pl-3.5 pr-1.5"
            >
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="What would you like to deploy?"
                className="w-full bg-transparent text-xs text-[#f7f3ec] placeholder:text-[#7c7369] focus:outline-none"
                aria-label="Simulate deployment prompt"
              />
              <button
                type="submit"
                aria-label="Switch workbench template"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a231b] text-[#e7dfd3] transition-colors hover:bg-[#f4ba4a] hover:text-[#110d08] cursor-pointer"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Right High-Contrast Cream Preview Card or Code Pane */}
          <div className="lg:col-span-7">
            {activeTab === "preview" ? (
              <div className="flex h-full flex-col justify-between rounded-xl bg-[#f6f2ea] p-5 text-[#14110e] shadow-inner sm:p-6">
                {/* Mini Preview Navbar */}
                <div className="flex items-center justify-between border-b border-[#e4ddd1] pb-3.5">
                  <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-[#14110e]">
                    {scenario.previewBrand}
                  </span>
                  <div className="flex items-center gap-4 text-[10px] font-medium text-[#6e665c]">
                    {scenario.previewNav.map((nav) => (
                      <span key={nav}>{nav}</span>
                    ))}
                    <Sparkles className="h-3 w-3 text-[#14110e]" />
                  </div>
                </div>

                {/* Interior Two-Column Layout matching Reference Clay Studio Card */}
                <div className="mt-5 grid items-center gap-5 sm:grid-cols-12">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e7dfd3] sm:col-span-6">
                    <Image
                      src="/images/workbench-studio.jpg"
                      alt="QuantumHost modular edge compute architecture"
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="space-y-3 sm:col-span-6">
                    <h3 className="font-display whitespace-pre-line text-xl font-medium leading-[1.15] tracking-[-0.025em] text-[#14110e] sm:text-2xl">
                      {scenario.previewHeading}
                    </h3>

                    <div className="space-y-2 pt-1">
                      {scenario.rows.map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between rounded-full border border-[#ded6c9] bg-[#faf7f2] px-3.5 py-2 text-[11px]"
                        >
                          <span className="font-medium text-[#14110e]">{row.label}</span>
                          <span className="flex items-center gap-1 text-[#787066]">
                            <span className="font-mono text-[10px]">{row.meta}</span>
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1">
                      <Link
                        href={isAuthenticated ? "/projects/new" : "/register"}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#f4ba4a] px-5 py-2.5 text-xs font-medium text-[#110d08] transition-colors hover:bg-[#f7c86b]"
                      >
                        {scenario.cta}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[290px] flex-col justify-between rounded-xl border border-[#26201a] bg-[#0b0907] p-5 font-mono text-xs text-[#dfd8ce]">
                <div className="flex items-center justify-between border-b border-[#221c16] pb-3 text-[11px] text-[#9a9084]">
                  <span>{scenario.files[0]}</span>
                  <span className="rounded-full border border-[#d49b4b]/35 bg-[#2a1d0e]/70 px-2.5 py-0.5 text-[10px] text-[#f4ba4a]">
                    TypeScript
                  </span>
                </div>
                <pre className="my-4 overflow-x-auto leading-relaxed text-[#e7dfd3]">
                  <code>{scenario.codeSnippet}</code>
                </pre>
                <div className="flex items-center justify-between border-t border-[#221c16] pt-3 text-[11px] text-[#8e857b]">
                  <span>Template preview — connect your repo in Console</span>
                  <button
                    type="button"
                    onClick={() => setScenarioIdx((prev) => (prev === 0 ? 1 : 0))}
                    className="text-[#f4ba4a] hover:underline cursor-pointer"
                  >
                    Switch template →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
