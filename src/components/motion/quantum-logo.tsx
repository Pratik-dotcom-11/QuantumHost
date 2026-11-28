"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { QH_EASE } from "@/components/motion/tokens";

export function QuantumLogo({
  size = "md",
  showText = true,
  showTagline = false,
  animateIdle = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showTagline?: boolean;
  animateIdle?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();

  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-14 w-14",
  }[size];

  const wordSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-3xl sm:text-4xl",
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className={cn("relative flex shrink-0 items-center justify-center", iconSizes)}>
        {/* Ambient golden glow */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#f4ba4a]/25 blur-md"
        />

        <motion.svg
          viewBox="0 0 48 48"
          className="relative h-full w-full"
          fill="none"
          aria-hidden="true"
          animate={
            animateIdle && !reduced
              ? { rotate: 360 }
              : undefined
          }
          transition={
            animateIdle && !reduced
              ? { duration: 24, repeat: Infinity, ease: "linear" }
              : undefined
          }
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="rgba(244, 186, 74, 0.28)"
            strokeWidth="1.5"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="#f4ba4a"
            strokeWidth="1.75"
            strokeDasharray="34 92"
            strokeLinecap="round"
          />
          <circle
            cx="24"
            cy="24"
            r="12.5"
            stroke="rgba(247, 243, 236, 0.24)"
            strokeWidth="1.25"
          />
          <circle cx="24" cy="4" r="2.2" fill="#f4ba4a" />
        </motion.svg>

        {/* Stationary center emblem */}
        <motion.span
          aria-hidden="true"
          initial={!reduced ? { scale: 0.85, opacity: 0 } : undefined}
          animate={!reduced ? { scale: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.45, ease: QH_EASE }}
          className="absolute h-2.5 w-2.5 rounded-full bg-[#f7f3ec] shadow-[0_0_12px_rgba(244,186,74,0.9)]"
        />
      </div>

      {showText ? (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display font-semibold tracking-normal text-[#f7f3ec]",
              wordSizes
            )}
          >
            QuantumHost
          </span>
          {showTagline ? (
            <span className="mt-1 font-sans text-[8px] font-light uppercase tracking-[0.28em] text-[#d49b4b]">
              Deploy Beyond Limits
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
