"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PUBLIC_NAV = [
  { href: "/#workbench", label: "Product" },
  { href: "/#architecture", label: "How it Works" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
];

export function PublicHeader({
  isAuthenticated,
  floating = false,
}: {
  isAuthenticated: boolean;
  floating?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "z-40 w-full",
        floating
          ? "absolute inset-x-0 top-5 px-4 sm:top-6 sm:px-6"
          : "sticky top-0 border-b border-[#241e18] bg-[#0b0907]/85 px-4 py-3 backdrop-blur-md sm:px-6"
      )}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between",
          floating
            ? "max-w-4xl rounded-full border border-white/12 bg-[#14110e]/75 px-5 py-2 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            : "max-w-6xl"
        )}
      >
        <Link
          href="/"
          className="font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f7f3ec] transition-opacity hover:opacity-85"
        >
          QuantumHost
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {PUBLIC_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-xs font-normal transition-colors",
                  active ? "text-[#f4ba4a]" : "text-[#c8bfb2] hover:text-white"
                )}
              >
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
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="mx-auto mt-2 max-w-4xl rounded-2xl border border-[#2a231c] bg-[#14110e]/95 p-4 backdrop-blur-lg shadow-2xl md:hidden">
          <div className="grid gap-1">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
        </div>
      ) : null}
    </header>
  );
}
