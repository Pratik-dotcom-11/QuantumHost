"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QuantumLogo } from "@/components/motion/quantum-logo";
import { QH_EASE } from "@/components/motion/tokens";

const INTRO_STORAGE_KEY = "qh_session_intro_seen_v1";

export function SessionIntro() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) {
      sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
      return;
    }

    const seen = sessionStorage.getItem(INTRO_STORAGE_KEY);
    if (seen) return;

    sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 1500);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [reduced]);

  function dismiss() {
    sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="dialog"
          aria-label="QuantumHost opening experience"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: QH_EASE }}
          onClick={dismiss}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0907] px-6 text-center"
        >
          {/* Ambient golden eclipse pulse behind logo */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.78 }}
            animate={{ opacity: 1, scale: 1.05 }}
            transition={{ duration: 0.9, ease: QH_EASE }}
            className="pointer-events-none absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(244,186,74,0.22)_0%,rgba(212,132,42,0.06)_45%,transparent_72%)] blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: QH_EASE }}
            className="relative z-10 flex flex-col items-center"
          >
            <QuantumLogo size="lg" showText showTagline={false} />

            {/* Subtle horizontal solar line */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.28, ease: QH_EASE }}
              className="mt-5 h-px w-44 origin-center bg-gradient-to-r from-transparent via-[#f4ba4a]/80 to-transparent"
            />

            <motion.p
              initial={{ opacity: 0, y: 8, letterSpacing: "0.38em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.28em" }}
              transition={{ duration: 0.5, delay: 0.36, ease: QH_EASE }}
              className="mt-3 font-sans text-[11px] font-light uppercase text-[#edd19a]"
            >
              Deploy Beyond Limits.
            </motion.p>
          </motion.div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            className="absolute bottom-8 right-8 rounded-full border border-[#2a231b] bg-[#14110e]/85 px-3.5 py-1.5 font-sans text-[11px] text-[#9a9084] transition-colors hover:border-[#d49b4b]/50 hover:text-[#f7f3ec] cursor-pointer"
          >
            Skip
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
