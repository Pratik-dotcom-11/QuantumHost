"use client";

import React, { useEffect, useState } from "react";
import { Github, Loader2 } from "lucide-react";
import type { GitHubAuthStatus } from "@/lib/auth/github-provider";
import { sanitizeRelativeRedirectPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/client";
import { GithubAuthSetupModal } from "@/components/auth/github-auth-setup-modal";
import { Button } from "@/components/ui/button";

interface GithubAuthButtonProps {
  nextPath?: string;
  disabled?: boolean;
  initialOpenSetup?: boolean;
  onError?: (message: string | null) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function GithubAuthButton({
  nextPath = "/dashboard",
  disabled = false,
  initialOpenSetup = false,
  onError,
  onLoadingChange,
}: GithubAuthButtonProps) {
  const safeNext = sanitizeRelativeRedirectPath(nextPath, "/dashboard");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubAuthStatus | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  function setBusy(busy: boolean) {
    setOauthLoading(busy);
    onLoadingChange?.(busy);
  }

  useEffect(() => {
    if (!initialOpenSetup) return;
    fetch("/api/auth/github/check?fresh=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: GitHubAuthStatus) => {
        setGithubStatus(data);
        setSetupModalOpen(true);
      })
      .catch(() => {
        setSetupModalOpen(true);
      });
  }, [initialOpenSetup]);

  async function startGitHubFlow(forceFresh = false) {
    onError?.(null);
    if (forceFresh) {
      setRetryFeedback(null);
    }
    setBusy(true);
    try {
      const checkRes = await fetch(`/api/auth/github/check${forceFresh ? "?fresh=1" : ""}`, {
        cache: "no-store",
      });

      if (checkRes.ok) {
        const status = (await checkRes.json()) as GitHubAuthStatus;
        setGithubStatus(status);

        if (!status.configured) {
          setBusy(false);
          if (forceFresh) {
            setRetryFeedback(
              `Checked at ${new Date().toLocaleTimeString()}: GitHub OAuth is still disabled in Supabase. Save Client ID & Secret in Supabase Dashboard first.`
            );
          }
          setSetupModalOpen(true);
          return;
        }

        if (status.mode === "direct") {
          setSetupModalOpen(false);
          const startUrl = new URL("/api/auth/github/start", window.location.origin);
          startUrl.searchParams.set("next", safeNext);
          window.location.assign(startUrl.toString());
          return;
        }
      }

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          scopes: "read:user user:email repo",
        },
      });
      if (oauthError) {
        const msg = oauthError.message.toLowerCase();
        if (msg.includes("unsupported provider") || msg.includes("not enabled")) {
          setSetupModalOpen(true);
        } else {
          onError?.(oauthError.message);
        }
        setBusy(false);
      } else {
        setSetupModalOpen(false);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "GitHub OAuth failed.");
      setBusy(false);
    }
  }

  return (
    <>
      <GithubAuthSetupModal
        open={setupModalOpen}
        status={githubStatus}
        onClose={() => {
          setSetupModalOpen(false);
          setRetryFeedback(null);
        }}
        onRetry={() => startGitHubFlow(true)}
        retrying={oauthLoading}
        retryFeedback={retryFeedback}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => startGitHubFlow(false)}
        disabled={oauthLoading || disabled}
      >
        {oauthLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Github className="h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
    </>
  );
}
