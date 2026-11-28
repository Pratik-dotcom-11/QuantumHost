"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QuantumLogo } from "@/components/motion/quantum-logo";
import { QH_EASE } from "@/components/motion/tokens";

const PUBLIC_NAV = [
  { href: "/#workbench", hash: "workbench", label: "Product" },
  { href: "/#architecture", hash: "architecture", label: "How it Works" },
  { href: "/docs", hash: null, label: "Docs" },
  { href: "/pricing", hash: null, label: "Pricing" },
];

function scrollToSection(hash: string) {
  const el = document.getElementById(hash);
  if (!el) return;
  const headerOffset = 88;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function PublicHeader({
  isAuthenticated,
  floating = false,
}: {
  isAuthenticated: boolean;
  floating?: boolean;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;

    function syncFromHash() {
      const current = window.location.hash.replace("#", "");
      if (current === "workbench" || current === "architecture") {
        setActiveHash(current);
      } else {
        setActiveHash(null);
      }
    }

    const frame = window.requestAnimationFrame(syncFromHash);

    const sectionIds = ["workbench", "architecture"];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHash(entry.target.id);
          }
        }
      },
      { rootMargin: "-35% 0px -50% 0px", threshold: 0.05 }
    );

    for (const el of elements) observer.observe(el);

    window.addEventListener("popstate", syncFromHash);
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("popstate", syncFromHash);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [pathname]);

  function handleNavClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    item: (typeof PUBLIC_NAV)[number]
  ) {
    setOpen(false);
    if (item.hash && pathname === "/") {
      e.preventDefault();
      window.history.pushState(null, "", `#${item.hash}`);
      setActiveHash(item.hash);
      scrollToSection(item.hash);
    }
  }

  return (
    <motion.header
      initial={!reduced ? { opacity: 0, y: -10 } : undefined}
      animate={!reduced ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.45, ease: QH_EASE }}
      className={cn(
        "z-40 w-full",
        floating
          ? "fixed inset-x-0 top-4 px-4 sm:top-5 sm:px-6"
          : "sticky top-0 border-b border-[#241e18] bg-[#0b0907]/85 px-4 py-3 backdrop-blur-md sm:px-6"
      )}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between",
          floating
            ? "max-w-4xl rounded-full border border-white/12 bg-[#14110e]/80 px-5 py-2 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            : "max-w-6xl"
        )}
      >
        <Link href="/" className="transition-opacity hover:opacity-90">
          <QuantumLogo size="sm" showText showTagline />
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary navigation">
          {PUBLIC_NAV.map((item) => {
            const effectiveHash = pathname === "/" ? activeHash : null;
            const active =
              (item.hash !== null && pathname === "/" && effectiveHash === item.hash) ||
              (item.hash === null && pathname === item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item)}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 text-xs font-normal transition-colors",
                  active ? "text-[#f4ba4a]" : "text-[#c8bfb2] hover:text-white"
                )}
              >
                {active && !reduced ? (
                  <motion.span
                    layoutId="public-nav-pill"
                    transition={{ duration: 0.25, ease: QH_EASE }}
                    className="absolute inset-0 -z-10 rounded-full border border-[#d49b4b]/35 bg-[#2a1d0e]/75"
                  />
                ) : active ? (
                  <span className="absolute inset-0 -z-10 rounded-full border border-[#d49b4b]/35 bg-[#2a1d0e]/75" />
                ) : null}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!isAuthenticated ? (
            <Link
              href="/login"
              className="text-xs font-normal text-[#c8bfb2] transition-colors hover:text-white"
            >
              Sign in
            </Link>
          ) : null}
          <Button asChild variant="light" size="sm" className="h-8 px-4 text-xs font-medium">
            <Link href={isAuthenticated ? "/dashboard" : "/register"}>
              {isAuthenticated ? "Open Console" : "Start a deployment"}
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-full border border-white/15 bg-[#1b1612]/90 p-1.5 text-[#c8bfb2] hover:text-white md:hidden cursor-pointer"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: QH_EASE }}
            className="mx-auto mt-2 max-w-4xl rounded-2xl border border-[#2a231c] bg-[#14110e]/95 p-4 backdrop-blur-lg shadow-2xl md:hidden"
          >
            <div className="grid gap-1">
              {PUBLIC_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-[#e7dfd3] hover:bg-[#1f1a15]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-[#26201a] pt-3">
              {isAuthenticated ? (
                <Button asChild variant="light" size="sm" className="w-full">
                  <Link href="/dashboard">Open Console</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild variant="light" size="sm" className="flex-1">
                    <Link href="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
