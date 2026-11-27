"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Cpu, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        toast({
          title: "Account created",
          description: "Your QuantumHost workspace is ready.",
          variant: "success",
        });
        router.push("/dashboard");
        router.refresh();
      } else {
        setConfirmationSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#d49b4b]/35 bg-[#2a1d0e]/75 text-[#f4ba4a]">
            <Cpu className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-medium text-[#f7f3ec]">
            Create your QuantumHost account
          </CardTitle>
          <CardDescription>
            Deploy Beyond Limits — provision isolated builds, custom domains, and live telemetry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/12 p-3 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {confirmationSent ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/12 p-4 text-sm text-emerald-200">
              <div className="flex items-center gap-2 font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Check your inbox to verify your email
              </div>
              <p className="text-xs text-emerald-200/90">
                We sent a confirmation link to <strong>{email}</strong>. Once confirmed, you can
                sign in to QuantumHost.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/login">Return to Sign In</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ada Lovelace"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ada@quantumhost.dev"
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
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create Account
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-[#9a9084]">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-[#f4ba4a] hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
