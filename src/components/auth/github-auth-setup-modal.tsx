"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Github,
  KeyRound,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import type { GitHubAuthStatus } from "@/lib/auth/github-provider";
import { Button } from "@/components/ui/button";

interface GithubAuthSetupModalProps {
  open: boolean;
  status: GitHubAuthStatus | null;
  onClose: () => void;
  onRetry: () => Promise<void>;
  retrying?: boolean;
}

export function GithubAuthSetupModal({
  open,
  status,
  onClose,
  onRetry,
  retrying = false,
}: GithubAuthSetupModalProps) {
  const [copiedField, setCopiedField] = useState<"supabase" | "direct" | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const supabaseCallbackUrl =
    status?.supabaseCallbackUrl || "https://ufmfbsrthpjahrnawirg.supabase.co/auth/v1/callback";
  const directCallbackUrl =
    status?.directCallbackUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/github/callback`
      : "http://localhost:3000/api/auth/github/callback");
  const supabaseDashboardUrl =
    status?.instructions.supabaseDashboardUrl ||
    "https://supabase.com/dashboard/project/ufmfbsrthpjahrnawirg/auth/providers";
  const githubNewAppUrl =
    status?.instructions.githubNewAppUrl || "https://github.com/settings/applications/new";
  const projectId = status?.supabaseProjectId || "ufmfbsrthpjahrnawirg";

  async function handleCopy(text: string, field: "supabase" | "direct") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API fallback ignored if denied
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-setup-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#2a231b] bg-[#14110e] p-6 text-[#f7f3ec] shadow-2xl shadow-black/80">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close setup dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#9a9084] transition-colors hover:bg-[#211c16] hover:text-[#f7f3ec] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#f4ba4a]/35 bg-[#f4ba4a]/12 text-[#f4ba4a]">
            <Github className="h-5 w-5" />
          </div>
          <div className="space-y-1 pr-6">
            <h2 id="github-setup-title" className="text-lg font-medium text-[#f7f3ec]">
              Enable GitHub OAuth Provider
            </h2>
            <p className="text-xs leading-relaxed text-[#9a9084]">
              QuantumHost intercepted a Supabase Auth configuration error before redirecting you to a
              broken error page.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f4ba4a]" />
          <div className="space-y-1">
            <p className="font-medium text-amber-100">
              {status?.message ||
                "Supabase returned: Unsupported provider: provider is not enabled."}
            </p>
            <p className="text-[11px] text-amber-200/80">
              Project ID: <code className="rounded bg-black/40 px-1.5 py-0.5">{projectId}</code>
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* Option 1: Supabase Native OAuth */}
          <div className="space-y-3 rounded-xl border border-[#2a231b] bg-[#0e0c0a] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#f4ba4a]">
                Recommended: Enable in Supabase Auth
              </span>
              <span className="rounded-full border border-[#2a231b] bg-[#1a1612] px-2 py-0.5 text-[10px] text-[#9a9084]">
                2 minutes
              </span>
            </div>

            <ol className="space-y-2.5 text-xs text-[#d6cfc5]">
              <li className="flex gap-2">
                <span className="font-semibold text-[#f4ba4a]">1.</span>
                <div className="space-y-1.5 flex-1">
                  <span>
                    Create a{" "}
                    <a
                      href={githubNewAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#f4ba4a] hover:underline"
                    >
                      GitHub OAuth App
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    and paste this exact Authorization callback URL:
                  </span>
                  <div className="flex items-center gap-2 rounded-lg border border-[#2a231b] bg-[#14110e] px-2.5 py-1.5 font-mono text-[11px] text-[#f7f3ec]">
                    <span className="truncate flex-1 select-all">{supabaseCallbackUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(supabaseCallbackUrl, "supabase")}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-[#2a231b] bg-[#1f1a15] px-2 py-1 text-[10px] text-[#f7f3ec] hover:border-[#f4ba4a]/50 cursor-pointer"
                    >
                      {copiedField === "supabase" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </li>

              <li className="flex gap-2">
                <span className="font-semibold text-[#f4ba4a]">2.</span>
                <div className="space-y-1 flex-1">
                  <span>
                    Open{" "}
                    <a
                      href={supabaseDashboardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#f4ba4a] hover:underline"
                    >
                      Supabase Authentication &rarr; Providers &rarr; GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    , toggle <strong>GitHub enabled</strong> ON, paste your Client ID &amp; Client
                    Secret, and click <strong>Save</strong>.
                  </span>
                </div>
              </li>
            </ol>
          </div>

          {/* Option 2: Direct Server Bridge */}
          <div className="space-y-2 rounded-xl border border-[#2a231b] bg-[#0e0c0a] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#d6cfc5]">
              <KeyRound className="h-3.5 w-3.5 text-[#9a9084]" />
              <span>Alternative: Direct Server OAuth Bridge (.env / Vercel)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#9a9084]">
              Set <code className="text-[#d6cfc5]">GITHUB_CLIENT_ID</code>,{" "}
              <code className="text-[#d6cfc5]">GITHUB_CLIENT_SECRET</code>, and{" "}
              <code className="text-[#d6cfc5]">SUPABASE_SERVICE_ROLE_KEY</code> in your environment
              variables with callback URL:
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-[#2a231b] bg-[#14110e] px-2.5 py-1.5 font-mono text-[11px] text-[#d6cfc5]">
              <span className="truncate flex-1 select-all">{directCallbackUrl}</span>
              <button
                type="button"
                onClick={() => handleCopy(directCallbackUrl, "direct")}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-[#2a231b] bg-[#1f1a15] px-2 py-1 text-[10px] text-[#f7f3ec] hover:border-[#f4ba4a]/50 cursor-pointer"
              >
                {copiedField === "direct" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={retrying}>
            Use Email Instead
          </Button>
          <Button type="button" onClick={onRetry} disabled={retrying}>
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verify &amp; Continue with GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
