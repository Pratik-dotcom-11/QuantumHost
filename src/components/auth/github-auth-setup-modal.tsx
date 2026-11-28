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
  retryFeedback?: string | null;
}

export function GithubAuthSetupModal({
  open,
  status,
  onClose,
  onRetry,
  retrying = false,
  retryFeedback = null,
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-setup-title"
    >
      <div className="relative my-auto max-h-[92dvh] w-full max-w-xl overflow-x-hidden overflow-y-auto rounded-2xl border border-[#2a231b] bg-[#14110e] p-4 text-[#f7f3ec] shadow-2xl shadow-black/80 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close setup dialog"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[#9a9084] transition-colors hover:bg-[#211c16] hover:text-[#f7f3ec] cursor-pointer sm:right-4 sm:top-4"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#f4ba4a]/35 bg-[#f4ba4a]/12 text-[#f4ba4a] sm:h-11 sm:w-11">
            <Github className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1 pr-7">
            <h2 id="github-setup-title" className="text-base font-medium text-[#f7f3ec] sm:text-lg">
              Enable GitHub OAuth Provider
            </h2>
            <p className="text-xs leading-relaxed text-[#9a9084]">
              GitHub OAuth credentials are not configured yet on Supabase or this server, so
              QuantumHost paused before redirecting to a raw HTTP 400 error.
            </p>
          </div>
        </div>

        <div className="mt-4 flex min-w-0 items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f4ba4a]" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium break-words text-amber-100">
              {status?.message ||
                "Supabase returned: Unsupported provider: provider is not enabled."}
            </p>
            <p className="text-[11px] text-amber-200/80">
              Project ID:{" "}
              <code className="break-all rounded bg-black/40 px-1.5 py-0.5">{projectId}</code>
            </p>
          </div>
        </div>

        {retryFeedback ? (
          <div className="mt-3 rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-xs text-rose-200">
            {retryFeedback}
          </div>
        ) : null}

        <div className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">
          {/* Option 1: Supabase Native OAuth */}
          <div className="min-w-0 space-y-3 rounded-xl border border-[#2a231b] bg-[#0e0c0a] p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#f4ba4a]">
                Recommended: Enable in Supabase Auth
              </span>
              <span className="shrink-0 rounded-full border border-[#2a231b] bg-[#1a1612] px-2 py-0.5 text-[10px] text-[#9a9084]">
                2 minutes
              </span>
            </div>

            <ol className="space-y-2.5 text-xs text-[#d6cfc5]">
              <li className="flex min-w-0 gap-2">
                <span className="shrink-0 font-semibold text-[#f4ba4a]">1.</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <span className="block break-words">
                    Create a{" "}
                    <a
                      href={githubNewAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#f4ba4a] hover:underline"
                    >
                      GitHub OAuth App
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>{" "}
                    and paste this exact Authorization callback URL:
                  </span>
                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[#2a231b] bg-[#14110e] px-2.5 py-1.5 font-mono text-[11px] text-[#f7f3ec]">
                    <span className="min-w-0 flex-1 truncate select-all">{supabaseCallbackUrl}</span>
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

              <li className="flex min-w-0 gap-2">
                <span className="shrink-0 font-semibold text-[#f4ba4a]">2.</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="block break-words">
                    Open{" "}
                    <a
                      href={supabaseDashboardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#f4ba4a] hover:underline"
                    >
                      Supabase Authentication &rarr; Providers &rarr; GitHub
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    , toggle <strong>GitHub enabled</strong> ON, paste your Client ID &amp; Client
                    Secret, and click <strong>Save</strong>.
                  </span>
                </div>
              </li>
            </ol>
          </div>

          {/* Option 2: Direct Server Bridge */}
          <div className="min-w-0 space-y-2 rounded-xl border border-[#2a231b] bg-[#0e0c0a] p-3.5 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#d6cfc5]">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#9a9084]" />
              <span className="truncate">Alternative: Direct Server OAuth Bridge (.env / Vercel)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#9a9084] break-words">
              Set <code className="text-[#d6cfc5]">GITHUB_CLIENT_ID</code>,{" "}
              <code className="text-[#d6cfc5]">GITHUB_CLIENT_SECRET</code>, and{" "}
              <code className="text-[#d6cfc5]">SUPABASE_SERVICE_ROLE_KEY</code> in your environment
              variables with callback URL:
            </p>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[#2a231b] bg-[#14110e] px-2.5 py-1.5 font-mono text-[11px] text-[#d6cfc5]">
              <span className="min-w-0 flex-1 truncate select-all">{directCallbackUrl}</span>
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
