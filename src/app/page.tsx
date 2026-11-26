import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
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
import { PartnerLogoStrip } from "@/components/marketing/partner-logo-strip";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const { user } = await getAuthenticatedUser();
  const isAuth = Boolean(user);

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#0a0e17]">
      <PublicHeader isAuthenticated={isAuth} />

      {/* 1. HERO SHOWCASE CARD (Dark Obsidian #040509 + Blended Reference Cobalt 3D Discs) */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#040509] px-6 py-14 text-white shadow-2xl shadow-slate-900/25 sm:px-12 sm:py-20">
          {/* Subtle architectural grid on left side */}
          <div className="qh-dark-grid pointer-events-none absolute inset-0 opacity-70" />

          {/* Exact reference photo blended into #040509 on the right */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-full sm:w-[78%] lg:w-[64%]">
            <Image
              src="/images/hero-cobalt-discs.jpg"
              alt="QuantumHost 3D cloud infrastructure layers"
              fill
              priority
              className="object-cover object-center opacity-100 brightness-125 contrast-110 saturate-115 sm:object-right"
            />
            {/* Multi-directional edge blending into #040509 without dimming the center discs */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#040509] via-[#040509]/20 via-30% to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#040509]/75 via-transparent via-25% to-[#040509]/30" />
            <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#040509]/80 to-transparent" />
          </div>

          <div className="relative z-10 max-w-xl space-y-6 py-2 sm:py-4">
            <h1 className="font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[52px]">
              The Cloud Platform
              <br />
              <span className="inline-block rounded-md border border-[#3b82f6]/55 bg-[#1d5bff]/20 px-2.5 py-0.5 text-[#7eb0ff]">
                Purpose-Built
              </span>{" "}
              for Scale
            </h1>

            <p className="max-w-md text-[13px] leading-relaxed text-slate-300 sm:text-[15px]">
              Deploy Beyond Limits. Ship Git repositories through isolated BullMQ build workers,
              immutable R2 object storage, and instant production rollbacks.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button asChild size="default">
                <Link href={isAuth ? "/dashboard" : "/register"}>
                  {isAuth ? "Open Console" : "Get Started"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Link
                href="/docs"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
              >
                Explore Docs
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PARTNER / INFRASTRUCTURE LOGO STRIP */}
      <PartnerLogoStrip />

      {/* 3. TRUST & CLARITY SPLIT SECTION (Isometric Stack + Embedded Dark Card) */}
      <section id="solutions" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: Exact Isometric Cloud Pipeline Illustration blended into #f8f9fb */}
          <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
            <div className="relative w-full overflow-hidden">
              <Image
                src="/images/trust-isometric.jpg"
                alt="QuantumHost isolated build pipeline and telemetry node"
                width={490}
                height={556}
                className="mx-auto h-auto w-full max-w-[440px] object-contain mix-blend-multiply"
              />
              {/* Soft outer edge feather so dashed grid lines melt smoothly into #f8f9fb */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_58%,#f8f9fb_100%)]" />
            </div>
          </div>

          {/* Right: Copy + Embedded Dark Feature Card */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#0b0f19] sm:text-3xl">
                Build trust and ship
                <br />
                with full clarity
              </h2>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-[#525b6c] sm:text-sm">
                Every build runs in a strictly isolated worker outside the web control plane, with
                per-tenant Row Level Security and AES-256-GCM secret encryption.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-[#070b14] p-6 text-white shadow-xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(29,91,255,0.28),transparent_50%)]" />
              <div className="relative z-10 space-y-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d5bff] text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Isolated build infrastructure, zero compromise
                  </h3>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#60a5fa]" />
                      Platform secrets stripped from build sandboxes
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#60a5fa]" />
                      X-Hub-Signature-256 verified webhooks
                    </li>
                  </ul>
                </div>
                <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">
                  Real-time log streaming and immutable deployment artifacts ensure predictable
                  releases with zero downtime rollbacks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FULL-STACK PLATFORM + HUB-AND-SPOKE ARCHITECTURE DIAGRAM */}
      <section id="platform" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#1d5bff]">
              QuantumHost Control Plane
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0b0f19] sm:text-3xl">
              A full-stack platform for modern workloads
            </h2>
            <p className="text-xs leading-relaxed text-[#525b6c] sm:text-sm">
              Connect GitHub repositories, orchestrate Redis + BullMQ queues, store immutable R2
              artifacts, verify custom DNS, and monitor uptime from one unified control plane.
            </p>
            <div className="pt-2">
              <Button asChild variant="dark" size="sm">
                <Link href="/docs#architecture">
                  Explore Architecture
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <p className="pt-2 text-[11px] text-slate-400">
              Built on Next.js, Supabase PostgreSQL 17, BullMQ, and Cloudflare R2.
            </p>
          </div>

          {/* Hub-and-spoke diagram matching sCalix node diagram */}
          <div className="relative rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 lg:col-span-7">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { icon: GitBranch, label: "GitHub App", sub: "OAuth & Webhooks" },
                { icon: Layers, label: "BullMQ Queue", sub: "Redis Job Broker" },
                { icon: Terminal, label: "Build Workers", sub: "Isolated Sandboxes" },
                { icon: HardDrive, label: "Object Storage", sub: "Cloudflare R2 / S3" },
                { icon: Globe, label: "Custom Domains", sub: "DNS TXT & TLS" },
                { icon: Sparkles, label: "AI Diagnostics", sub: "Gemini / OpenAI" },
              ].map((node) => {
                const Icon = node.icon;
                return (
                  <div
                    key={node.label}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-[#f8f9fb] p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1d5bff] text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#0b0f19]">{node.label}</p>
                      <p className="truncate text-[10px] text-[#525b6c]">{node.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-[#0b0f19] px-5 py-2.5 text-xs font-semibold text-white shadow-lg">
                <Cpu className="h-4 w-4 text-[#60a5fa]" />
                QuantumHost Control Plane (RLS + AES-GCM)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PLATFORM INFRASTRUCTURE (Soft Sky-Blue Atmospheric Band + 3 White Cards) */}
      <section id="infrastructure" className="qh-sky-band py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#525b6c]">
              Engineered for Reliability
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#0b0f19] sm:text-4xl">
              Platform Infrastructure
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-[#525b6c] sm:text-sm">
              Purpose-built cloud execution, immutable artifact delivery, and custom domain routing
              designed for predictable production workloads.
            </p>
            <div className="mt-4">
              <Link
                href="/docs"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0b0f19] hover:text-[#1d5bff]"
              >
                Explore all capabilities
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Server,
                title: "Build Workers",
                body: "Isolated BullMQ workers execute git clone, install, and build scripts with strict timeouts and zero access to platform credentials.",
              },
              {
                icon: Database,
                title: "Artifact Storage",
                body: "Immutable deployment trees stored in Cloudflare R2, Supabase Storage, or local disk for instant zero-rebuild production rollbacks.",
              },
              {
                icon: Network,
                title: "Networking & DNS",
                body: "Live DNS TXT/CNAME verification, automated TLS status tracking, and HTTP availability probes measuring endpoint latency.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white bg-white p-6 shadow-md shadow-slate-900/5"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b0f19] text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-[#0b0f19]">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#525b6c]">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. INTERACTIVE 4-COLUMN CAPABILITY TABS */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <CapabilityTabs />
      </section>

      {/* 8. DOTTED WORLD MAP / EDGE REGIONS */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden">
          <Image
            src="/images/global-regions-map.jpg"
            alt="QuantumHost global cloud regions map"
            width={1024}
            height={383}
            className="mx-auto h-auto w-full object-contain mix-blend-multiply"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_68%,#f8f9fb_100%)]" />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-[11px] font-medium">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[#0b0f19] shadow-2xs">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#1d5bff]" />
            ap-south-1 · Supabase Control Plane
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[#0b0f19] shadow-2xs">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#1d5bff]" />
            Global Edge · Cloudflare R2 &amp; CDN
          </span>
        </div>
      </section>

      {/* 9. BOTTOM DARK ROUNDED CTA BANNER */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#040509] px-6 py-16 text-center text-white shadow-2xl sm:px-12 sm:py-20">
          <div className="qh-dark-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="pointer-events-none absolute -bottom-8 right-0 h-60 w-88 opacity-95">
            <Image
              src="/images/hero-cobalt-discs.jpg"
              alt=""
              fill
              className="object-cover object-left-top brightness-125 contrast-110 saturate-115"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#040509] via-[#040509]/25 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#040509]/80 via-transparent to-transparent" />
          </div>
          <div className="relative z-10 mx-auto max-w-lg space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Create locally, Launch globally!
            </h2>
            <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
              Deploy Beyond Limits — connect your GitHub repository, trigger an isolated build, and
              go live in seconds.
            </p>
            <div className="pt-2">
              <Button asChild size="default">
                <Link href={isAuth ? "/projects/new" : "/register"}>
                  {isAuth ? "Import Project" : "Get Started"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
