"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Cpu, Github, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const nextPath = searchParams.get("next") || "/dashboard";
  const initialError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? "Authentication callback failed. Please try signing in again." : null
  );

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
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubLogin() {
    setError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          scopes: "read:user user:email repo",
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setOauthLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub OAuth failed.");
      setOauthLoading(false);
    }
  }

  return (
    <div className="qh-light-grid flex min-h-screen flex-col items-center justify-center bg-[#f8f9fb] px-4 py-12">
      <div className="mb-6 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#525b6c] hover:text-[#0b0f19]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to QuantumHost
        </Link>
      </div>

      <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b0f19] text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Sign in to QuantumHost</CardTitle>
          <CardDescription>
            Deploy Beyond Limits — access your cloud projects and isolated build pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGitHubLogin}
            disabled={oauthLoading || loading}
          >
            {oauthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            Continue with GitHub
          </Button>

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-slate-200" />
            <span className="mx-3 text-[11px] uppercase tracking-wider text-slate-400">
              or email
            </span>
            <div className="grow border-t border-slate-200" />
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
              <Label htmlFor="password">Password</Label>
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

          <p className="text-center text-xs text-[#525b6c]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-[#1d5bff] hover:underline">
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
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
          <Loader2 className="h-6 w-6 animate-spin text-[#1d5bff]" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
