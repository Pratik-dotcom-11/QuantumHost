"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Boxes },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/usage", label: "Usage Analytics", icon: BarChart3 },
  { href: "/settings", label: "Account Settings", icon: Settings },
];

interface AppShellProps {
  userEmail: string;
  userName: string;
  children: React.ReactNode;
}

export function AppShell({ userEmail, userName, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-[#221c16] px-5">
        <Link
          href="/dashboard"
          className="flex flex-col leading-none transition-opacity hover:opacity-90"
        >
          <span className="font-display text-lg font-semibold tracking-normal text-[#f7f3ec]">
            QuantumHost
          </span>
          <span className="font-sans text-[8px] font-light uppercase tracking-[0.28em] text-[#d49b4b]">
            Deploy Beyond Limits
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Console navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "border border-[#d49b4b]/35 bg-[#2a1d0e]/70 text-[#f4ba4a]"
                  : "text-[#9a9084] hover:bg-[#191410] hover:text-[#f7f3ec]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[#221c16] p-3">
        <Link
          href="/docs"
          className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-[#9a9084] hover:bg-[#191410] hover:text-[#f7f3ec]"
        >
          <BookOpen className="h-3.5 w-3.5 text-[#f4ba4a]" />
          Documentation
        </Link>
        <div className="rounded-xl border border-[#26201a] bg-[#14110e] px-3.5 py-2.5">
          <p className="truncate text-xs font-semibold text-[#f7f3ec]">{userName}</p>
          <p className="truncate text-[11px] text-[#9a9084]">{userEmail}</p>
        </div>
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[#9a9084] hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#0b0907] text-[#f7f3ec]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-[#221c16] bg-[#100d0a] lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 border-r border-[#26201a] bg-[#100d0a]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-full p-1 text-[#9a9084] hover:text-[#f7f3ec] cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#221c16] bg-[#0b0907]/85 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-full border border-[#2a231c] bg-[#14110e] p-1.5 text-[#9a9084] hover:text-[#f7f3ec] lg:hidden cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-mono text-xs text-[#9a9084]">
              quantumhost / control-plane · ap-south-1
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/api/health" target="_blank">
                System Health
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/projects/new">Import Project</Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
