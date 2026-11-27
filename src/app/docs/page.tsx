import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Cpu,
  Database,
  GitBranch,
  Globe,
  Lock,
  Sparkles,
  Terminal,
} from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DOC_SECTIONS = [
  {
    id: "architecture",
    icon: Cpu,
    title: "System Architecture",
    file: "docs/ARCHITECTURE.md",
    summary:
      "12 separated subsystems separating the Next.js control plane from Redis/BullMQ orchestration, isolated build workers, and Cloudflare R2/edge delivery.",
  },
  {
    id: "lifecycle",
    icon: Terminal,
    title: "Deployment Lifecycle",
    file: "docs/DEPLOYMENT_LIFECYCLE.md",
    summary:
      "9-stage pipeline from GitHub connection and package.json inspection to sandboxed builds, immutable uploads, atomic promotion, and rollbacks.",
  },
  {
    id: "database",
    icon: Database,
    title: "Database Design & RLS",
    file: "docs/DATABASE_DESIGN.md",
    summary:
      "Supabase PostgreSQL 17 ER diagram, foreign-key indexing, monotonic deployment numbering triggers, and strict per-tenant Row Level Security policies.",
  },
  {
    id: "security",
    icon: Lock,
    title: "Security Architecture",
    file: "docs/SECURITY_ARCHITECTURE.md",
    summary:
      "AES-256-GCM secret encryption, X-Hub-Signature-256 webhook verification, worker env sanitization, log redaction, and path-traversal guards.",
  },
  {
    id: "github",
    icon: GitBranch,
    title: "GitHub & Integrations",
    file: "docs/INTEGRATIONS.md",
    summary:
      "GitHub App RS256 JWT authentication, OAuth/PAT connection modes, Cloudflare R2 S3 endpoints, and Custom Hostnames API integration.",
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "AI Build Diagnostics",
    file: "docs/TECH_STACK.md",
    summary:
      "Provider-independent AI diagnostic layer supporting Google Gemini, OpenAI, Anthropic Claude, and custom OpenAI-compatible endpoints.",
  },
];

export default async function DocsPage() {
  const { user } = await getAuthenticatedUser();

  return (
    <div className="min-h-screen bg-[#0b0907] text-[#f7f3ec]">
      <PublicHeader isAuthenticated={Boolean(user)} />

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <Badge>
            <BookOpen className="h-3.5 w-3.5" />
            QuantumHost Documentation
          </Badge>
          <h1 className="font-display mt-5 text-4xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
            Developer &amp; Infrastructure Reference
          </h1>
          <p className="mt-3 text-sm text-[#9a9084] sm:text-base">
            Explore the technical specifications, API contracts, security boundaries, and deployment
            workflows powering QuantumHost.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {DOC_SECTIONS.map((doc) => {
            const Icon = doc.icon;
            return (
              <Card key={doc.id} id={doc.id}>
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#d49b4b]/30 bg-[#2a1d0e]/70 text-[#f4ba4a]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{doc.title}</CardTitle>
                  <CardDescription className="font-mono text-[11px] text-[#f4ba4a]">
                    {doc.file}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-[#9a9084]">{doc.summary}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="relative mt-12 overflow-hidden rounded-3xl border border-[#2c2319] bg-[#14110e] p-8 text-[#f7f3ec] shadow-2xl">
          <div className="qh-amber-glow pointer-events-none absolute inset-0" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-base font-medium text-[#f7f3ec]">
              <Globe className="h-5 w-5 text-[#f4ba4a]" />
              Quickstart: Deploy Your First Project
            </div>
            <p className="mt-1 text-xs text-[#9a9084]">
              Follow these steps to configure credentials and launch your first isolated build.
            </p>
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-[#d7cfc3] sm:text-sm">
              <li>
                Create a QuantumHost account via{" "}
                <Link href="/register" className="text-[#f4ba4a] hover:underline">
                  /register
                </Link>{" "}
                or sign in with GitHub.
              </li>
              <li>
                Connect a GitHub account in{" "}
                <Link href="/settings" className="text-[#f4ba4a] hover:underline">
                  Account Settings
                </Link>{" "}
                using OAuth or a fine-grained Personal Access Token.
              </li>
              <li>
                Import a repository in{" "}
                <Link href="/projects/new" className="text-[#f4ba4a] hover:underline">
                  New Project
                </Link>
                , inspect its detected framework preset, and add encrypted environment variables.
              </li>
              <li>
                Start Redis and the isolated build worker (`npm run worker:dev`) and click{" "}
                <strong>Deploy Now</strong> to watch live logs stream to completion.
              </li>
            </ol>

            <div className="mt-6">
              <Button asChild size="sm">
                <Link href={user ? "/projects/new" : "/register"}>
                  {user ? "Import Repository" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
