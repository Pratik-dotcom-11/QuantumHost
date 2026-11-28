"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QuantumLogo } from "@/components/motion/quantum-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setUpdated(true);
      toast({
        title: "Password updated",
        description: "Your credentials have been securely updated.",
        variant: "success",
      });
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="qh-grid-subtle relative flex min-h-screen flex-col items-center justify-center bg-[#0b0907] px-4 py-12 text-[#f7f3ec]">
      <div className="qh-amber-glow pointer-events-none absolute inset-0" />

      <div className="relative z-10 mb-6 w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9a9084] transition-colors hover:text-[#f7f3ec]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
      </div>

      <Card className="relative z-10 w-full max-w-md border-[#2a231b] bg-[#14110e]/95 shadow-2xl shadow-black/60 backdrop-blur-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex justify-center">
            <QuantumLogo size="md" showText={false} />
          </div>
          <CardTitle className="text-xl font-medium text-[#f7f3ec]">
            Set a new password
          </CardTitle>
          <CardDescription>
            Choose a strong password (minimum 8 characters) to restore access to QuantumHost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/12 p-3 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {updated ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/12 p-4 text-xs text-emerald-200">
              <div className="flex items-center gap-2 font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Password updated — redirecting to console...
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Update Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
