"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QH_EASE } from "@/components/motion/tokens";

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
  const reduced = useReducedMotion();
  const current = CAPABILITIES.find((c) => c.id === activeId) ?? CAPABILITIES[0]!;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 border-b border-[#26201a] pb-6 sm:grid-cols-4">
        {CAPABILITIES.map((cap) => {
          const isActive = cap.id === activeId;
          return (
            <button
              key={cap.id}
              type="button"
              onClick={() => setActiveId(cap.id)}
              className={`group text-left transition-opacity cursor-pointer ${
                isActive ? "opacity-100" : "opacity-50 hover:opacity-85"
              }`}
            >
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f4ba4a]">
                {cap.eyebrow}
              </p>
              <p
                className={`font-display mt-1.5 text-xl font-medium tracking-[-0.012em] sm:text-2xl ${
                  isActive ? "text-[#f7f3ec]" : "text-[#9a9084]"
                }`}
              >
                {cap.title}
              </p>
              <div className="mt-3 h-0.5 w-12">
                {isActive ? (
                  reduced ? (
                    <div className="h-full w-full rounded-full bg-[#f4ba4a]" />
                  ) : (
                    <motion.div
                      layoutId="capability-underline"
                      transition={{ duration: 0.28, ease: QH_EASE }}
                      className="h-full w-full rounded-full bg-[#f4ba4a]"
                    />
                  )
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={current.id}
          initial={!reduced ? { opacity: 0, y: 6 } : undefined}
          animate={!reduced ? { opacity: 1, y: 0 } : undefined}
          exit={!reduced ? { opacity: 0, y: -4 } : undefined}
          transition={{ duration: 0.22, ease: QH_EASE }}
          className="max-w-xl text-sm leading-relaxed text-[#a89e91]"
        >
          {current.description}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
