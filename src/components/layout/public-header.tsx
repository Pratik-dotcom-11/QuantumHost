"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Cpu, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PUBLIC_NAV = [
  { href: "/#platform", label: "Platform", hasMenu: true },
  { href: "/#solutions", label: "Solutions", hasMenu: true },
  { href: "/pricing", label: "Pricing", hasMenu: false },
  { href: "/#infrastructure", label: "Infrastructure", hasMenu: false },
  { href: "/docs", label: "Docs", hasMenu: false },
];

export function PublicHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e8ef] bg-[#f9fafb]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0a0e17] text-white">
            <Cpu className="h-4 w-4" />
          </div>
          <span className="font-display text-[15px] font-bold tracking-[-0.025em] text-[#0a0e17]">
            QuantumHost
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary navigation">
          {PUBLIC_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-[#1d5bff]" : "text-[#525b6c] hover:text-[#0b0f19]"
                )}
              >
                {item.label}
                {item.hasMenu ? <ChevronDown className="h-3 w-3 opacity-60" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {isAuthenticated ? (
            <Button asChild variant="dark" size="sm">
              <Link href="/dashboard">
                Open Console
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-medium text-[#525b6c] transition-colors hover:text-[#0b0f19]"
              >
                Sign In
              </Link>
              <Button asChild variant="dark" size="sm">
                <Link href="/register">
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-[#525b6c] hover:text-[#0b0f19] md:hidden cursor-pointer"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="grid gap-1">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#0b0f19] hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
            {isAuthenticated ? (
              <Button asChild variant="dark" size="sm" className="w-full">
                <Link href="/dashboard">Open Console</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild variant="dark" size="sm" className="flex-1">
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
