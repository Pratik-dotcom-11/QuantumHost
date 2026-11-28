"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { sanitizeRelativeRedirectPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/client";
import { GithubAuthButton } from "@/components/auth/github-auth-button";
import { QuantumLogo } from "@/components/motion/quantum-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

function mapAuthErrorMessage(rawError: string | null): string | null {
  if (!rawError) return null;
  if (rawError === "github_setup_required") {
    return "GitHub OAuth is not enabled in your Supabase project yet. Follow the setup guide to enable it.";
  }
  if (rawError === "github_invalid_state") {
    return "GitHub authentication session expired or state mismatch. Please try signing in again.";
  }
  if (rawError === "github_email_required") {
    return "Your GitHub account must have a verified primary email address to sign in.";
  }
  if (rawError === "auth_callback_failed") {
    return "Authentication callback failed. Please try signing in again.";
  }
  return rawError;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const nextPath = sanitizeRelativeRedirectPath(searchParams.get("next"), "/dashboard");
  const initialError = searchParams.get("error");
  const shouldOpenSetup = Boolean(
    initialError &&
      (initialError === "github_setup_required" ||
        initialError.toLowerCase().includes("unsupported provider") ||
        initialError.toLowerCase().includes("provider is not enabled"))
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(mapAuthErrorMessage(initialError));

  async function handlePasswordReset() {
    setError(null);
    setResetSent(false);
    if (!email.trim()) {
      setError("Enter your email address first so we can send a password reset link.");
      return;
    }
    setResetSending(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setResetSent(true);
      toast({
        title: "Reset link sent",
        description: `Check ${email.trim()} for your password reset email.`,
        variant: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send password reset email.");
    } finally {
      setResetSending(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      toast({ title: "Signed in", description: "Welcome back to QuantumHost.", variant: "success" });
      router.push(sanitizeRelativeRedirectPath(nextPath, "/dashboard"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="qh-grid-subtle relative flex min-h-screen flex-col items-center justify-center bg-[#0b0907] px-4 py-12 text-[#f7f3ec]">
      <div className="qh-amber-glow pointer-events-none absolute inset-0" />

      <div className="relative z-10 mb-6 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9a9084] transition-colors hover:text-[#f7f3ec]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to QuantumHost
        </Link>
      </div>

      <Card className="relative z-10 w-full max-w-md border-[#2a231b] bg-[#14110e]/95 shadow-2xl shadow-black/60 backdrop-blur-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex justify-center">
            <QuantumLogo size="md" showText={false} />
          </div>
          <CardTitle className="text-xl font-medium text-[#f7f3ec]">Sign in to QuantumHost</CardTitle>
          <CardDescription>
            Deploy Beyond Limits — access your cloud projects and isolated build pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/12 p-3 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {resetSent ? (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/12 p-3 text-xs text-emerald-200">
              Password reset link sent to <strong>{email}</strong>. Open the link in your inbox to
              choose a new password.
            </div>
          ) : null}

          <GithubAuthButton
            nextPath={nextPath}
            disabled={loading}
            initialOpenSetup={shouldOpenSetup}
            onError={setError}
            onLoadingChange={setOauthLoading}
          />

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-[#26201a]" />
            <span className="mx-3 text-[11px] uppercase tracking-wider text-[#7c7369]">
              or email
            </span>
            <div className="grow border-t border-[#26201a]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetSending || loading}
                  className="text-[11px] font-medium text-[#f4ba4a] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {resetSending ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || oauthLoading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-[#9a9084]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-[#f4ba4a] hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0b0907]">
          <Loader2 className="h-6 w-6 animate-spin text-[#f4ba4a]" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
