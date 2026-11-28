"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { QH_DURATION, QH_EASE, QH_VIEWPORT } from "@/components/motion/tokens";

export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={QH_VIEWPORT}
      transition={{ duration: QH_DURATION.base, delay, ease: QH_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGroup({
  children,
  className,
  stagger = 0.065,
  viewport = true,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  viewport?: boolean;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      {...(viewport
        ? { whileInView: "visible", viewport: QH_VIEWPORT }
        : { animate: "visible" })}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: QH_DURATION.base, ease: QH_EASE },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({
  routeKey,
  children,
  className,
}: {
  routeKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: QH_DURATION.fast, ease: QH_EASE }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Lightweight pointer-reactive obsidian surface with CSS custom-property lighting.
 * Avoids React state updates during pointer moves for smooth 60fps interaction.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--qh-mx", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--qh-my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        "group/spot relative overflow-hidden rounded-2xl border border-[#26201a] bg-[#14110e] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#3e3226] hover:shadow-[0_14px_38px_rgba(0,0,0,0.48)]",
        className
      )}
    >
      {!reduced ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            background:
              "radial-gradient(280px circle at var(--qh-mx, 50%) var(--qh-my, 50%), rgba(244, 186, 74, 0.09), transparent 70%)",
          }}
        />
      ) : null}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * Counts up strictly from 0 (or previous real value) to `value`.
 * Never fabricates telemetry; displays exact target when reduced-motion is preferred.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  locale = false,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  locale?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(0);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      prevRef.current = value;
      return;
    }

    const from = prevRef.current;
    const controls = animate(from, value, {
      duration: 0.75,
      ease: QH_EASE,
      onUpdate(latest) {
        setDisplay(latest);
      },
      onComplete() {
        setDisplay(value);
        prevRef.current = value;
      },
    });

    return () => {
      controls.stop();
    };
  }, [value, reduced]);

  const shown = reduced || !Number.isFinite(value) ? value : display;
  const formatted =
    decimals > 0
      ? shown.toFixed(decimals)
      : locale
      ? Math.round(shown).toLocaleString()
      : String(Math.round(shown));

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
