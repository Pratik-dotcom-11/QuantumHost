"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Cpu,
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
      <div className="flex h-16 items-center gap-2.5 border-b border-[#e5e8ef] px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0a0e17] text-white">
            <Cpu className="h-4 w-4" />
          </div>
          <span className="font-display text-[15px] font-bold tracking-[-0.025em] text-[#0a0e17]">
            QuantumHost
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
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[#edf3ff] text-[#1d5bff]"
                  : "text-[#525b6c] hover:bg-slate-100 hover:text-[#0b0f19]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <Link
          href="/docs"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[#525b6c] hover:bg-slate-100 hover:text-[#0b0f19]"
        >
          <BookOpen className="h-3.5 w-3.5 text-[#1d5bff]" />
          Documentation
        </Link>
        <div className="rounded-xl border border-slate-200 bg-[#f8f9fb] px-3 py-2">
          <p className="truncate text-xs font-semibold text-[#0b0f19]">{userName}</p>
          <p className="truncate text-[11px] text-[#525b6c]">{userEmail}</p>
        </div>
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[#525b6c] hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 border-r border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-[#525b6c] hover:text-[#0b0f19] cursor-pointer"
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-[#525b6c] hover:text-[#0b0f19] lg:hidden cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-mono text-xs text-[#525b6c]">
              quantumhost / control-plane · ap-south-1
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/api/health" target="_blank">
                System Health
              </Link>
            </Button>
            <Button asChild variant="dark" size="sm">
              <Link href="/projects/new">Import Project</Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
