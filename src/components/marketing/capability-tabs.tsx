"use client";

import React, { useState } from "react";

const CAPABILITIES = [
  {
    id: "build",
    eyebrow: "ISOLATED SANDBOXES",
    title: "Build",
    description:
      "Execute npm install and framework builds inside ephemeral isolated workspaces with stripped platform secrets, timeout enforcement, and real-time log streaming.",
  },
  {
    id: "deploy",
    eyebrow: "IMMUTABLE ARTIFACTS",
    title: "Deploy",
    description:
      "Upload versioned static outputs to Cloudflare R2 or Supabase Storage and promote active production routes atomically with instant one-click rollbacks.",
  },
  {
    id: "monitor",
    eyebrow: "CONTINUOUS PROBES",
    title: "Monitor",
    description:
      "Run live HTTP availability checks, track round-trip latency history across deployments, and inspect per-project compute, storage, and request usage.",
  },
  {
    id: "diagnose",
    eyebrow: "PROVIDER-INDEPENDENT AI",
    title: "Diagnose",
    description:
      "Analyze failed deployment logs with Google Gemini, OpenAI, Anthropic, or custom endpoints to pinpoint root causes and actionable remediation steps.",
  },
];

export function CapabilityTabs() {
  const [activeId, setActiveId] = useState("deploy");
  const current = CAPABILITIES.find((c) => c.id === activeId) ?? CAPABILITIES[0]!;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 border-b border-[#e5e8ef] pb-6 sm:grid-cols-4">
        {CAPABILITIES.map((cap) => {
          const isActive = cap.id === activeId;
          return (
            <button
              key={cap.id}
              type="button"
              onClick={() => setActiveId(cap.id)}
              className={`group text-left transition-colors cursor-pointer ${
                isActive ? "opacity-100" : "opacity-50 hover:opacity-85"
              }`}
            >
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#1d5bff]">
                {cap.eyebrow}
              </p>
              <p
                className={`font-display mt-1.5 text-xl font-semibold tracking-[-0.025em] sm:text-2xl ${
                  isActive ? "text-[#0a0e17]" : "text-[#556070]"
                }`}
              >
                {cap.title}
              </p>
              <div
                className={`mt-3 h-0.5 w-12 rounded-full transition-all ${
                  isActive ? "bg-[#1d5bff]" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      <p className="max-w-xl text-sm leading-relaxed text-[#556070]">
        {current.description}
      </p>
    </div>
  );
}
