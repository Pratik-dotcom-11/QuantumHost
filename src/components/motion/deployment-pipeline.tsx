"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Cpu, GitBranch, Globe, HardDrive, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { QH_EASE } from "@/components/motion/tokens";

type RealStatus = "queued" | "building" | "uploading" | "ready" | "failed" | "cancelled";

interface StageDef {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StageDef[] = [
  { id: "source", label: "GitHub Repo", sub: "Commit & Webhook", icon: GitBranch },
  { id: "build", label: "Build Worker", sub: "Isolated Sandbox", icon: Cpu },
  { id: "artifact", label: "Artifact Store", sub: "Cloudflare R2", icon: HardDrive },
  { id: "live", label: "Live Website", sub: "Edge Route Active", icon: Globe },
];

function resolveStageStates(status: RealStatus) {
  switch (status) {
    case "queued":
      return { activeIdx: 0, state: "active" as const };
    case "building":
      return { activeIdx: 1, state: "active" as const };
    case "uploading":
      return { activeIdx: 2, state: "active" as const };
    case "ready":
      return { activeIdx: 3, state: "complete" as const };
    case "failed":
    case "cancelled":
      return { activeIdx: 1, state: "failed" as const };
    default:
      return { activeIdx: 0, state: "active" as const };
  }
}

export function DeploymentPipeline({
  mode = "real",
  status = "ready",
  className,
}: {
  mode?: "real" | "preview";
  status?: RealStatus | string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [simStep, setSimStep] = useState(0);

  useEffect(() => {
    if (mode !== "preview" || reduced) return;
    const id = window.setInterval(() => {
      setSimStep((prev) => (prev + 1) % 4);
    }, 2200);
    return () => window.clearInterval(id);
  }, [mode, reduced]);

  const resolved =
    mode === "preview"
      ? { activeIdx: simStep, state: simStep === 3 ? ("complete" as const) : ("active" as const) }
      : resolveStageStates(status as RealStatus);

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#26201a] bg-[#120f0c] p-4 sm:p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-[#9a9084]">
          {mode === "preview" ? "Pipeline Lifecycle Preview" : "Deployment Pipeline"}
        </span>
        {mode === "preview" ? (
          <span className="rounded-full border border-[#d49b4b]/30 bg-[#2a1d0e]/50 px-2.5 py-0.5 text-[10px] text-[#edd19a]">
            Interactive Flow
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-2">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isComplete =
            resolved.state === "complete"
              ? idx <= resolved.activeIdx
              : idx < resolved.activeIdx;
          const isCurrent =
            resolved.state === "active" && idx === resolved.activeIdx;
          const isFailed =
            resolved.state === "failed" && idx === resolved.activeIdx;

          return (
            <div key={stage.id} className="relative flex items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2">
              {/* Connecting line on desktop */}
              {idx < STAGES.length - 1 ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[58%] right-[-42%] top-6 hidden h-[2px] overflow-hidden rounded-full bg-[#241e18] sm:block"
                >
                  {isComplete ? (
                    <motion.div
                      initial={!reduced ? { scaleX: 0 } : undefined}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.45, ease: QH_EASE }}
                      className="h-full origin-left bg-gradient-to-r from-[#f4ba4a]/80 to-emerald-400/80"
                    />
                  ) : isCurrent && !reduced ? (
                    <motion.div
                      animate={{ x: ["-40%", "120%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                      className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#f4ba4a] to-transparent"
                    />
                  ) : null}
                </div>
              ) : null}

              <motion.button
                type={mode === "preview" ? "button" : "button"}
                onClick={() => {
                  if (mode === "preview") setSimStep(idx);
                }}
                whileHover={mode === "preview" && !reduced ? { y: -2 } : undefined}
                className={cn(
                  "relative z-10 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:flex-col sm:items-start sm:gap-2",
                  mode === "preview" ? "cursor-pointer" : "cursor-default",
                  isComplete
                    ? "border-emerald-500/35 bg-emerald-500/10"
                    : isFailed
                    ? "border-rose-500/40 bg-rose-500/10"
                    : isCurrent
                    ? "border-[#f4ba4a]/65 bg-[#2a1d0e]/70 shadow-[0_0_24px_rgba(244,186,74,0.12)]"
                    : "border-[#241e18] bg-[#16120e] opacity-75"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border",
                      isComplete
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : isFailed
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        : isCurrent
                        ? "border-[#f4ba4a]/50 bg-[#f4ba4a]/20 text-[#f4ba4a]"
                        : "border-[#2a231c] bg-[#1d1813] text-[#9a9084]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : isFailed ? (
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f4ba4a]" />
                  ) : null}
                </div>

                <div>
                  <p className="text-xs font-medium text-[#f7f3ec]">{stage.label}</p>
                  <p className="text-[11px] text-[#9a9084]">{stage.sub}</p>
                </div>
              </motion.button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
