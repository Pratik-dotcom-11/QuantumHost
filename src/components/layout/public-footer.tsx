import Link from "next/link";
import { Github, Globe, ShieldCheck, Terminal } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="overflow-hidden border-t border-[#221c16] bg-[#0b0907] pt-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid gap-10 pb-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="inline-flex flex-col leading-none">
              <span className="font-display text-xl font-semibold tracking-normal text-[#f7f3ec]">
                QuantumHost
              </span>
              <span className="mt-1 font-sans text-[9px] font-light uppercase tracking-[0.28em] text-[#d49b4b]">
                Deploy Beyond Limits
              </span>
            </Link>
            <p className="max-w-xs text-xs leading-relaxed text-[#8e857b]">
              Deploy Beyond Limits. Isolated build workers, immutable R2 storage, custom DNS
              verification, and AI build diagnostics.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/docs"
                aria-label="Documentation"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2a231b] bg-[#14110e] text-[#9a9084] transition-colors hover:border-[#d49b4b]/50 hover:text-[#f7f3ec]"
              >
                <Terminal className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/api/health"
                aria-label="Health status"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2a231b] bg-[#14110e] text-[#9a9084] transition-colors hover:border-[#d49b4b]/50 hover:text-[#f7f3ec]"
              >
                <Globe className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/docs#security"
                aria-label="Security architecture"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2a231b] bg-[#14110e] text-[#9a9084] transition-colors hover:border-[#d49b4b]/50 hover:text-[#f7f3ec]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/settings"
                aria-label="GitHub integration"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2a231b] bg-[#14110e] text-[#9a9084] transition-colors hover:border-[#d49b4b]/50 hover:text-[#f7f3ec]"
              >
                <Github className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c7369]">
              Platform
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#9a9084]">
              <li>
                <Link href="/#workbench" className="hover:text-[#f7f3ec]">
                  Workbench Preview
                </Link>
              </li>
              <li>
                <Link href="/#architecture" className="hover:text-[#f7f3ec]">
                  Architecture
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[#f7f3ec]">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c7369]">
              Resources
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#9a9084]">
              <li>
                <Link href="/docs" className="hover:text-[#f7f3ec]">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/docs#security" className="hover:text-[#f7f3ec]">
                  Security Model
                </Link>
              </li>
              <li>
                <Link href="/docs#database" className="hover:text-[#f7f3ec]">
                  Database Schema
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c7369]">
              Console
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#9a9084]">
              <li>
                <Link href="/login" className="hover:text-[#f7f3ec]">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-[#f7f3ec]">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[#f7f3ec]">
                  Control Plane
                </Link>
              </li>
              <li>
                <Link href="/api/health" className="hover:text-[#f7f3ec]">
                  System Status
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[#221c16] py-6 text-xs text-[#7c7369] sm:flex-row">
          <p>© {new Date().getFullYear()} QuantumHost Cloud Infrastructure.</p>
          <p className="font-mono text-[11px]">Next.js · Supabase · BullMQ · Cloudflare R2</p>
        </div>
      </div>
    </footer>
  );
}
