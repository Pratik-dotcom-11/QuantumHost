"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Github,
  KeyRound,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { AiProviderType } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

interface GitHubConnection {
  id: string;
  provider_type: string;
  github_login: string;
  installation_id: number | null;
  scopes: string[];
  created_at: string;
}

interface AiConfigView {
  provider: AiProviderType;
  model: string;
  baseUrl: string | null;
  hasUserApiKey: boolean;
  maskedKey: string | null;
  isEnabled: boolean;
}

export function SettingsClient({
  initialProfile,
  initialConnections,
  oauthConfigured,
  appSlug,
  initialAiConfig,
  serverAiConfigured,
}: {
  initialProfile: { email: string; fullName: string; plan: string };
  initialConnections: GitHubConnection[];
  oauthConfigured: boolean;
  appSlug?: string | null;
  initialAiConfig: AiConfigView;
  serverAiConfigured: boolean;
}) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [savingProfile, setSavingProfile] = useState(false);

  const [connections, setConnections] = useState(initialConnections);
  const [patToken, setPatToken] = useState("");
  const [connectingPat, setConnectingPat] = useState(false);

  const [provider, setProvider] = useState<AiProviderType>(initialAiConfig.provider);
  const [model, setModel] = useState(initialAiConfig.model);
  const [baseUrl, setBaseUrl] = useState(initialAiConfig.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [aiEnabled, setAiEnabled] = useState(initialAiConfig.isEnabled);
  const [maskedKey, setMaskedKey] = useState(initialAiConfig.maskedKey);
  const [savingAi, setSavingAi] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to update profile");
      toast({
        title: "Profile updated",
        description: "Your account details have been saved.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Profile update failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleConnectPat(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setConnectingPat(true);
    try {
      const res = await fetch("/api/github/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: "pat",
          accessToken: patToken.trim(),
        }),
      });
      const json = (await res.json()) as { connection?: GitHubConnection; error?: string };
      if (!res.ok || !json.connection) {
        throw new Error(json.error || "Failed to connect GitHub token");
      }
      setConnections((prev) => [
        json.connection!,
        ...prev.filter((c) => c.id !== json.connection!.id),
      ]);
      setPatToken("");
      const msg = `Connected GitHub account @${json.connection.github_login}.`;
      setFeedback({ type: "ok", text: msg });
      toast({ title: "GitHub connected", description: msg, variant: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect GitHub";
      setFeedback({ type: "err", text: msg });
      toast({ title: "GitHub connection failed", description: msg, variant: "error" });
    } finally {
      setConnectingPat(false);
    }
  }

  async function handleDisconnectGitHub(id: string) {
    const res = await fetch(`/api/github/connections?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "GitHub account disconnected", variant: "info" });
    }
  }

  async function handleSaveAi(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSavingAi(true);
    try {
      const res = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          baseUrl: baseUrl.trim() || null,
          apiKey: apiKey.trim() || undefined,
          isEnabled: aiEnabled,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save AI configuration");
      if (apiKey.trim()) {
        setMaskedKey(`${apiKey.trim().slice(0, 2)}••••••${apiKey.trim().slice(-2)}`);
      }
      setApiKey("");
      setFeedback({ type: "ok", text: "AI provider settings saved securely." });
      toast({
        title: "AI configuration saved",
        description: `Active provider: ${provider} (${model})`,
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save AI settings";
      setFeedback({ type: "err", text: msg });
      toast({ title: "Save failed", description: msg, variant: "error" });
    } finally {
      setSavingAi(false);
    }
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
            feedback.type === "ok"
              ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
              : "border-rose-500/35 bg-rose-500/12 text-rose-300"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {/* Account Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#f4ba4a]" />
              Account Profile
            </CardTitle>
            <Badge variant="violet">{initialProfile.plan} plan</Badge>
          </div>
          <CardDescription>
            Manage your workspace identity and billing plan tier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-5 sm:items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prof-name">Display Name</Label>
              <Input
                id="prof-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prof-email">Email Address</Label>
              <Input id="prof-email" value={initialProfile.email} disabled />
            </div>
            <Button type="submit" disabled={savingProfile} className="sm:col-span-1">
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* GitHub Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5 text-[#f4ba4a]" />
            GitHub Account Connections
          </CardTitle>
          <CardDescription>
            Connect GitHub via OAuth App or encrypted Personal Access Token (`repo` scope) to
            import repositories and register push webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {appSlug ? (
              <Button asChild size="sm">
                <a
                  href={`https://github.com/apps/${appSlug}/installations/new`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="h-4 w-4" />
                  Install GitHub App
                </a>
              </Button>
            ) : null}
            {oauthConfigured ? (
              <Button asChild variant="outline" size="sm">
                <a href="/api/github/oauth/start">
                  <Github className="h-4 w-4" />
                  Authorize via GitHub OAuth
                </a>
              </Button>
            ) : !appSlug ? (
              <span className="rounded-xl border border-[#26201a] bg-[#0f0c0a] px-3 py-2 text-xs text-[#9a9084]">
                GitHub OAuth / App env vars not set (`GITHUB_CLIENT_ID` / `GITHUB_APP_SLUG`). Use
                encrypted Personal Access Token below.
              </span>
            ) : null}
          </div>

          <form onSubmit={handleConnectPat} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="gh-pat">
                Connect with Personal Access Token (fine-grained or classic)
              </Label>
              <Input
                id="gh-pat"
                type="password"
                placeholder="ghp_... or github_pat_..."
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={connectingPat}>
              {connectingPat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Verify & Connect
            </Button>
          </form>

          {connections.length > 0 ? (
            <div className="space-y-2.5">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-xl border border-[#26201a] bg-[#0f0c0a] px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">@{conn.github_login}</span>
                      <Badge variant="secondary">{conn.provider_type}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Connected {formatRelativeTime(conn.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDisconnectGitHub(conn.id)}
                    aria-label={`Disconnect @${conn.github_login}`}
                  >
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Provider-Independent AI Layer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#f4ba4a]" />
            AI Build Diagnostics Provider
          </CardTitle>
          <CardDescription>
            Configure your preferred LLM provider for automated failed-deployment root-cause
            analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveAi} className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3.5">
              <div>
                <p className="text-sm font-medium">Enable AI Diagnostics</p>
                <p className="text-xs text-muted-foreground">
                  Server fallback key:{" "}
                  {serverAiConfigured
                    ? "Configured"
                    : "Not configured (provide your own key below)"}
                </p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-prov">AI Provider</Label>
                <Select
                  id="ai-prov"
                  value={provider}
                  onChange={(e) => {
                    const next = e.target.value as AiProviderType;
                    setProvider(next);
                    if (next === "gemini") setModel("gemini-2.5-flash");
                    else if (next === "openai") setModel("gpt-4o-mini");
                    else if (next === "anthropic") setModel("claude-3-5-haiku-latest");
                  }}
                >
                  <option value="gemini">Google Gemini (Free Tier Available)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai_compatible">OpenAI-Compatible Custom Endpoint</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-model">Model Identifier</Label>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>
            </div>

            {provider === "openai_compatible" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ai-base">Base URL</Label>
                <Input
                  id="ai-base"
                  placeholder="https://openrouter.ai/api/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="ai-key">
                API Key {maskedKey ? `(currently stored: ${maskedKey})` : ""}
              </Label>
              <Input
                id="ai-key"
                type="password"
                placeholder={
                  maskedKey ? "Leave blank to keep stored key" : "Enter provider API key"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={savingAi}>
              {savingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save AI Configuration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
