import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TIERS = [
  {
    name: "Developer",
    price: "$0",
    cadence: "forever",
    badge: "Free Tier",
    description: "For individual developers prototyping and hosting personal web projects.",
    features: [
      "Up to 10 GB artifact storage (Cloudflare R2 free tier)",
      "Unlimited static asset bandwidth",
      "GitHub App, OAuth & webhook auto-deployments",
      "Encrypted environment variables (AES-256-GCM)",
      "Instant atomic rollbacks",
      "BYO AI key (Gemini free tier compatible)",
    ],
    cta: "Start Free",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$25",
    cadence: "/ month",
    badge: "Most Popular",
    description: "Always-on production infrastructure with higher concurrency and backups.",
    features: [
      "Everything in Developer",
      "Dedicated BullMQ worker concurrency & zero inactivity pause",
      "Automated daily database backups & PITR",
      "Up to 100 custom domains with managed TLS",
      "1-minute availability monitoring & latency history",
      "Priority email & operational support",
    ],
    cta: "Launch Pro Workspace",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    badge: "Dedicated",
    description: "Isolated VPC build clusters, custom SLAs, and compliance controls.",
    features: [
      "Dedicated Firecracker / Cloud Run build pools",
      "Unlimited custom hostnames ($0.10/hostname beyond 100)",
      "Custom S3/R2 & private GitHub Enterprise Server support",
      "SAML SSO & audit log retention",
      "99.99% uptime SLA",
    ],
    cta: "Open Console",
    href: "/login",
    highlighted: false,
  },
];

export default async function PricingPage() {
  const { user } = await getAuthenticatedUser();

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#0b0f19]">
      <PublicHeader isAuthenticated={Boolean(user)} />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge>Transparent Infrastructure Pricing</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#0b0f19] sm:text-5xl">
            Predictable scaling from side project to production
          </h1>
          <p className="mt-4 text-sm text-[#525b6c] sm:text-base">
            Built on zero-egress artifact storage and isolated build queues with clear free-tier
            boundaries.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={`flex flex-col justify-between ${
                tier.highlighted
                  ? "border-[#1d5bff] bg-[#060911] text-white shadow-2xl shadow-slate-900/20"
                  : "border-slate-200 bg-white"
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-lg ${tier.highlighted ? "text-white" : ""}`}>
                    {tier.name}
                  </CardTitle>
                  <Badge variant={tier.highlighted ? "default" : "secondary"}>{tier.badge}</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span
                    className={`text-4xl font-bold ${
                      tier.highlighted ? "text-white" : "text-[#0b0f19]"
                    }`}
                  >
                    {tier.price}
                  </span>
                  <span
                    className={`text-xs ${tier.highlighted ? "text-slate-400" : "text-[#525b6c]"}`}
                  >
                    {tier.cadence}
                  </span>
                </div>
                <CardDescription className={`pt-2 ${tier.highlighted ? "text-slate-300" : ""}`}>
                  {tier.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between space-y-6">
                <ul
                  className={`space-y-2.5 text-sm ${
                    tier.highlighted ? "text-slate-200" : "text-[#525b6c]"
                  }`}
                >
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tier.highlighted ? "text-[#60a5fa]" : "text-[#1d5bff]"
                        }`}
                      />
                      <span className="text-xs leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={tier.highlighted ? "default" : "dark"}
                  className="w-full"
                >
                  <Link href={user ? "/dashboard" : tier.href}>
                    {user ? "Go to Dashboard" : tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
