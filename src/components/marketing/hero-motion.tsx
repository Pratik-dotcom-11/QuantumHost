"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QH_EASE } from "@/components/motion/tokens";

export function HeroMotion({ isAuth }: { isAuth: boolean }) {
  const reduced = useReducedMotion();

  const fadeUp = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: QH_EASE },
        };

  return (
    <div className="relative z-10 mx-auto flex min-h-[600px] max-w-4xl flex-col items-center justify-center px-4 pb-20 pt-32 text-center sm:min-h-[660px] sm:px-6 sm:pt-36">
      {/* Subtle solar horizon glow drift */}
      <div
        aria-hidden="true"
        className="qh-horizon-drift pointer-events-none absolute top-24 h-64 w-96 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(244,186,74,0.16),transparent_70%)] blur-2xl"
      />

      <motion.div
        {...fadeUp(0.05)}
        className="relative inline-flex items-center gap-2 rounded-full border border-[#d49b4b]/40 bg-[#2a1d0e]/55 px-4 py-1 text-[11px] font-medium text-[#edd19a] backdrop-blur-sm"
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-[#f4ba4a]"
        />
        Your Next Build Starts Here · Deploy Beyond Limits
      </motion.div>

      <h1 className="font-display relative mt-6 max-w-3xl text-[38px] font-semibold leading-[1.06] tracking-[-0.01em] text-white sm:text-[58px]">
        <motion.span {...fadeUp(0.14)} className="block">
          Turn The Code In Your Repo
        </motion.span>
        <motion.span {...fadeUp(0.24)} className="block">
          Into Production You Can Scale.
        </motion.span>
      </h1>

      <motion.p
        {...fadeUp(0.32)}
        className="relative mt-5 max-w-xl text-[13px] leading-relaxed text-[#d7cfc3] sm:text-[15px]"
      >
        Plan, build, and monitor isolated web deployments with an AI diagnostics partner that keeps
        your infrastructure moving.
      </motion.p>

      <motion.div
        {...fadeUp(0.4)}
        className="relative mt-8 flex flex-wrap items-center justify-center gap-3.5"
      >
        <Button asChild size="lg" className="hover:shadow-[0_0_32px_rgba(244,186,74,0.3)]">
          <Link href={isAuth ? "/projects/new" : "/register"}>
            Start Your First Build
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="#workbench">
            See How QuantumHost Works
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
