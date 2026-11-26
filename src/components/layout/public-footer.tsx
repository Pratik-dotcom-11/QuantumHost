import Link from "next/link";
import { Cpu, Github, Globe, Terminal, ShieldCheck } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="overflow-hidden border-t border-slate-200 bg-[#f8f9fb] pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 pb-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0b0f19] text-white">
                <Cpu className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold tracking-tight text-[#0b0f19]">
                QuantumHost
              </span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-[#525b6c]">
              Deploy Beyond Limits. Cloud hosting, isolated build workers, and operational
              telemetry engineered for modern teams.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/docs"
                aria-label="Documentation"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#525b6c] hover:border-slate-300 hover:text-[#0b0f19]"
              >
                <Terminal className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/api/health"
                aria-label="Health status"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#525b6c] hover:border-slate-300 hover:text-[#0b0f19]"
              >
                <Globe className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/docs#security"
                aria-label="Security architecture"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#525b6c] hover:border-slate-300 hover:text-[#0b0f19]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/settings"
                aria-label="GitHub integration"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#525b6c] hover:border-slate-300 hover:text-[#0b0f19]"
              >
                <Github className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Platform
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#525b6c]">
              <li>
                <Link href="/#platform" className="hover:text-[#0b0f19]">
                  Control Plane
                </Link>
              </li>
              <li>
                <Link href="/#infrastructure" className="hover:text-[#0b0f19]">
                  Build Workers
                </Link>
              </li>
              <li>
                <Link href="/#solutions" className="hover:text-[#0b0f19]">
                  Object Storage
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[#0b0f19]">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Resources
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#525b6c]">
              <li>
                <Link href="/docs" className="hover:text-[#0b0f19]">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/docs#architecture" className="hover:text-[#0b0f19]">
                  System Architecture
                </Link>
              </li>
              <li>
                <Link href="/docs#security" className="hover:text-[#0b0f19]">
                  Security Model
                </Link>
              </li>
              <li>
                <Link href="/docs#database" className="hover:text-[#0b0f19]">
                  Database Schema
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Console
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#525b6c]">
              <li>
                <Link href="/login" className="hover:text-[#0b0f19]">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-[#0b0f19]">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[#0b0f19]">
                  Overview Dashboard
                </Link>
              </li>
              <li>
                <Link href="/api/health" className="hover:text-[#0b0f19]">
                  System Status
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-6 text-xs text-[#525b6c] sm:flex-row">
          <p>© {new Date().getFullYear()} QuantumHost Cloud Infrastructure.</p>
          <p className="font-mono text-[11px]">Next.js · Supabase · Redis/BullMQ · Cloudflare R2</p>
        </div>
      </div>
    </footer>
  );
}
