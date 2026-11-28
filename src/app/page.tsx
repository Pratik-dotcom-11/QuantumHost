import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Database,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { CapabilityTabs } from "@/components/marketing/capability-tabs";
import { HeroMotion } from "@/components/marketing/hero-motion";
import { PartnerLogoStrip } from "@/components/marketing/partner-logo-strip";
import { WorkbenchShowcase } from "@/components/marketing/workbench-showcase";
import { DeploymentPipeline } from "@/components/motion/deployment-pipeline";
import {
  ScrollReveal,
  SpotlightCard,
  StaggerGroup,
  StaggerItem,
} from "@/components/motion/primitives";
import { SessionIntro } from "@/components/motion/session-intro";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const { user } = await getAuthenticatedUser();
  const isAuth = Boolean(user);

  return (
    <div className="min-h-screen bg-[#0b0907] text-[#f7f3ec]">
      {/* Opening Experience — plays once per browser session */}
      <SessionIntro />

      {/* 1. ATMOSPHERIC GOLDEN HORIZON HERO WITH FLOATING PILL NAVBAR */}
      <section className="relative overflow-hidden bg-[#0b0907]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/hero-eclipse-horizon.jpg"
            alt="QuantumHost solar eclipse horizon backdrop"
            fill
            priority
            className="object-cover object-center opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0907]/55 via-transparent via-45% to-[#0b0907]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,#0b0907_96%)]" />
        </div>

        <PublicHeader isAuthenticated={isAuth} floating />
        <HeroMotion isAuth={isAuth} />
      </section>

      {/* 2. INTERACTIVE WORKBENCH SHOWCASE */}
      <WorkbenchShowcase isAuthenticated={isAuth} />

      {/* 3. INFRASTRUCTURE ECOSYSTEM MARQUEE */}
      <ScrollReveal>
        <PartnerLogoStrip />
      </ScrollReveal>

      {/* 4. ARCHITECTURE & DEPLOYMENT PIPELINE ANIMATION */}
      <section id="architecture" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <ScrollReveal className="space-y-5 lg:col-span-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#f4ba4a]">
              Isolated Control Plane
            </p>
            <h2 className="font-display text-2xl font-medium tracking-[-0.015em] text-[#f7f3ec] sm:text-3xl">
              Built for predictable releases at every scale
            </h2>
            <p className="text-xs leading-relaxed text-[#9a9084] sm:text-sm">
              Every build executes inside an isolated BullMQ sandbox outside the web plane, with
              AES-256-GCM secret encryption, Row Level Security, and immutable R2 artifacts.
            </p>
            <div className="pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href="/docs#architecture">
                  Explore Architecture
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="space-y-4 lg:col-span-7">
            <DeploymentPipeline mode="preview" />

            <div className="rounded-2xl border border-[#26201a] bg-[#14110e] p-5 sm:p-6">
              <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2" stagger={0.05}>
                {[
                  { icon: GitBranch, label: "GitHub App & OAuth", sub: "Signed webhook triggers" },
                  { icon: Layers, label: "BullMQ Job Queue", sub: "Redis-backed build orchestration" },
                  { icon: Terminal, label: "Sandboxed Workers", sub: "Platform secrets stripped" },
                  { icon: HardDrive, label: "Immutable Storage", sub: "Cloudflare R2 & instant rollback" },
                  { icon: Globe, label: "Custom DNS & TLS", sub: "Live TXT & CNAME verification" },
                  { icon: Sparkles, label: "AI Failure Triage", sub: "Gemini, OpenAI & Anthropic BYOK" },
                ].map((node) => {
                  const Icon = node.icon;
                  return (
                    <StaggerItem key={node.label}>
                      <div className="flex items-center gap-3 rounded-xl border border-[#26201a] bg-[#1a1511] p-3.5 transition-colors hover:border-[#d49b4b]/40">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d49b4b]/30 bg-[#2a1d0e]/70 text-[#f4ba4a]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[#f7f3ec]">{node.label}</p>
                          <p className="truncate text-[11px] text-[#9a9084]">{node.sub}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerGroup>

              <div className="mt-5 flex items-center justify-center border-t border-[#221c16] pt-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#342a20] bg-[#0b0907] px-4 py-2 font-mono text-[11px] text-[#d7cfc3]">
                  <Cpu className="h-3.5 w-3.5 text-[#f4ba4a]" />
                  Supabase PostgreSQL 17 · RLS + AES-256-GCM
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 5. CORE PLATFORM PILLARS */}
      <section className="border-y border-[#221c16] bg-[#100d0a] py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto max-w-xl text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9a9084]">
              Engineered for Reliability
            </p>
            <h2 className="font-display mt-2 text-2xl font-medium tracking-[-0.015em] text-[#f7f3ec] sm:text-4xl">
              Platform Infrastructure
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-[#9a9084] sm:text-sm">
              Purpose-built build isolation, immutable artifact delivery, and live endpoint probes
              unified in one dark architectural control plane.
            </p>
          </ScrollReveal>

          <StaggerGroup className="mt-10 grid gap-5 md:grid-cols-3" stagger={0.08}>
            {[
              {
                icon: Server,
                title: "Isolated Build Workers",
                body: "BullMQ workers execute clone, install, and build stages with strict output caps, timeouts, and redacted log streaming.",
              },
              {
                icon: Database,
                title: "Immutable Artifacts",
                body: "Versioned deployment trees uploaded to Cloudflare R2 or Supabase Storage allow instant zero-rebuild production rollbacks.",
              },
              {
                icon: ShieldCheck,
                title: "DNS & Uptime Probes",
                body: "Automated DNS TXT verification, TLS status tracking, and HTTP probes measuring real round-trip latency.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={item.title}>
                  <SpotlightCard className="h-full p-6">
                    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[#d49b4b]/30 bg-[#2a1d0e]/70 text-[#f4ba4a]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-display text-base font-medium text-[#f7f3ec]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#9a9084]">{item.body}</p>
                  </SpotlightCard>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* 6. INTERACTIVE 4-STAGE CAPABILITY TABS */}
      <ScrollReveal className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <CapabilityTabs />
      </ScrollReveal>

      {/* 7. BOTTOM SOLAR CTA BANNER */}
      <ScrollReveal className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <SpotlightCard className="rounded-3xl border-[#2c2319] bg-[#110d09] px-6 py-16 text-center shadow-2xl sm:px-12 sm:py-20">
          <div className="qh-amber-glow pointer-events-none absolute inset-0" />
          <div className="relative z-10 mx-auto max-w-lg space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d49b4b]/35 bg-[#2a1d0e]/60 px-3.5 py-1 text-[11px] font-medium text-[#edd19a]">
              <Network className="h-3 w-3 text-[#f4ba4a]" />
              ap-south-1 · Global Edge Ready
            </span>
            <h2 className="font-display text-2xl font-medium tracking-[-0.015em] text-white sm:text-3xl">
              Deploy Beyond Limits.
            </h2>
            <p className="text-xs leading-relaxed text-[#a89e91] sm:text-sm">
              Connect a GitHub repository, configure encrypted environment variables, and ship your
              first immutable deployment in seconds.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="default">
                <Link href={isAuth ? "/projects/new" : "/register"}>
                  {isAuth ? "Import Project" : "Get Started"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="default">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </SpotlightCard>
      </ScrollReveal>

      <PublicFooter />
    </div>
  );
}
