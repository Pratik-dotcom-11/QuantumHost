"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Github,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";
import { FRAMEWORK_PRESETS } from "@/lib/frameworks";
import { slugify } from "@/lib/utils";
import type { FrameworkType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface GitHubConnection {
  id: string;
  provider_type: string;
  github_login: string;
}

interface RepoItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
}

export function NewProjectWizard({
  connections,
}: {
  connections: GitHubConnection[];
}) {
  const router = useRouter();
  const [selectedConnId, setSelectedConnId] = useState(connections[0]?.id ?? "");
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [branches, setBranches] = useState<string[]>(["main"]);
  const [detecting, setDetecting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [repoFullName, setRepoFullName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [framework, setFramework] = useState<FrameworkType>("vite");
  const [rootDirectory, setRootDirectory] = useState(".");
  const [installCommand, setInstallCommand] = useState("npm ci");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [nodeVersion, setNodeVersion] = useState<"18" | "20" | "22" | "24">("20");
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [registerWebhook, setRegisterWebhook] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedConnId) return;
    let active = true;

    async function loadRepos() {
      setLoadingRepos(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/github/repos?connectionId=${encodeURIComponent(selectedConnId)}`
        );
        const json = (await res.json()) as { repos?: RepoItem[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to fetch repositories");
        if (active) setRepos(json.repos ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load repos");
      } finally {
        if (active) setLoadingRepos(false);
      }
    }

    void loadRepos();
    return () => {
      active = false;
    };
  }, [selectedConnId]);

  async function handleSelectRepo(repo: RepoItem) {
    setSelectedRepo(repo);
    setName(repo.name);
    setSlug(slugify(repo.name));
    setRepoFullName(repo.full_name);
    setRepoUrl(repo.html_url);
    setDefaultBranch(repo.default_branch || "main");
    setRegisterWebhook(true);

    if (!selectedConnId) return;
    setDetecting(true);
    try {
      const [branchRes, inspectRes] = await Promise.all([
        fetch(
          `/api/github/repos?connectionId=${encodeURIComponent(selectedConnId)}&repo=${encodeURIComponent(
            repo.full_name
          )}`
        ),
        fetch("/api/github/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: selectedConnId,
            repoFullName: repo.full_name,
            branch: repo.default_branch || "main",
            rootDirectory,
          }),
        }),
      ]);

      if (branchRes.ok) {
        const bJson = (await branchRes.json()) as { branches?: string[] };
        if (bJson.branches?.length) setBranches(bJson.branches);
      }
      if (inspectRes.ok) {
        const iJson = (await inspectRes.json()) as {
          preset?: {
            id: FrameworkType;
            installCommand: string;
            buildCommand: string;
            outputDirectory: string;
          };
        };
        if (iJson.preset) {
          setFramework(iJson.preset.id);
          setInstallCommand(iJson.preset.installCommand);
          setBuildCommand(iJson.preset.buildCommand);
          setOutputDirectory(iJson.preset.outputDirectory);
        }
      }
    } finally {
      setDetecting(false);
    }
  }

  function handleFrameworkChange(next: FrameworkType) {
    setFramework(next);
    const preset = FRAMEWORK_PRESETS[next];
    setInstallCommand(preset.installCommand);
    setBuildCommand(preset.buildCommand);
    setOutputDirectory(preset.outputDirectory);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || slugify(name),
          githubConnectionId: selectedConnId || null,
          repoFullName: repoFullName || null,
          repoId: selectedRepo?.id ?? null,
          repoUrl: repoUrl || (repoFullName ? `https://github.com/${repoFullName}` : null),
          framework,
          defaultBranch,
          rootDirectory,
          installCommand,
          buildCommand,
          outputDirectory,
          nodeVersion,
          autoDeploy,
          registerWebhook: Boolean(selectedConnId && registerWebhook),
        }),
      });
      const json = (await res.json()) as {
        project?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.project) {
        throw new Error(json.error || "Failed to create project");
      }
      router.push(`/projects/${json.project.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left: GitHub Repository Picker */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-4 w-4 text-[#1d5bff]" />
            Import Git Repository
          </CardTitle>
          <CardDescription>
            Select a repository from a connected GitHub account or enter a public repo manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.length > 0 ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="gh-account">GitHub Account</Label>
                <Select
                  id="gh-account"
                  value={selectedConnId}
                  onChange={(e) => setSelectedConnId(e.target.value)}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      @{c.github_login} ({c.provider_type})
                    </option>
                  ))}
                </Select>
              </div>

              {loadingRepos ? (
                <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-[#1d5bff]" />
                  Fetching repositories from GitHub...
                </div>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {repos.map((repo) => {
                    const active = selectedRepo?.id === repo.id;
                    return (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => handleSelectRepo(repo)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                          active
                            ? "border-[#1d5bff] bg-blue-50"
                            : "border-border bg-[#f8f9fb] hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {repo.full_name}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {repo.private ? "Private" : "Public"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {repo.language || "Web"} · branch {repo.default_branch}
                        </p>
                      </button>
                    );
                  })}
                  {repos.length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">
                      No repositories returned for this connection.
                    </p>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed border-border bg-[#f8f9fb] p-4 text-xs text-muted-foreground">
              <p>No GitHub accounts connected yet.</p>
              <p>
                You can connect GitHub in Settings for private repositories and auto-webhooks, or enter
                a public repository path (e.g. <code className="text-[#1d5bff]">owner/repo</code>) on the right.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Connect GitHub Account</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Build & Project Configuration */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configure Project</CardTitle>
              <CardDescription>
                Customize build commands, output directory, and deployment settings.
              </CardDescription>
            </div>
            {detecting ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#1d5bff]">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Inspecting package.json...
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Project Name</Label>
                <Input
                  id="proj-name"
                  placeholder="my-web-app"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!selectedRepo) setSlug(slugify(e.target.value));
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-slug">URL Slug</Label>
                <Input
                  id="proj-slug"
                  placeholder="my-web-app"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="repo-full">GitHub Repository (owner/repo)</Label>
                <Input
                  id="repo-full"
                  placeholder="vercel/next.js"
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch">Production Branch</Label>
                {branches.length > 1 ? (
                  <Select
                    id="branch"
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id="branch"
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                    required
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="framework">Framework Preset</Label>
                <Select
                  id="framework"
                  value={framework}
                  onChange={(e) => handleFrameworkChange(e.target.value as FrameworkType)}
                >
                  {Object.values(FRAMEWORK_PRESETS).map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="root-dir">Root Directory</Label>
                <Input
                  id="root-dir"
                  value={rootDirectory}
                  onChange={(e) => setRootDirectory(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="node-ver">Node.js Version</Label>
                <Select
                  id="node-ver"
                  value={nodeVersion}
                  onChange={(e) =>
                    setNodeVersion(e.target.value as "18" | "20" | "22" | "24")
                  }
                >
                  <option value="20">Node 20 LTS</option>
                  <option value="22">Node 22 LTS</option>
                  <option value="24">Node 24</option>
                  <option value="18">Node 18</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="install-cmd">Install Command</Label>
                <Input
                  id="install-cmd"
                  placeholder="npm ci"
                  value={installCommand}
                  onChange={(e) => setInstallCommand(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="build-cmd">Build Command</Label>
                <Input
                  id="build-cmd"
                  placeholder="npm run build"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="output-dir">Output Directory</Label>
                <Input
                  id="output-dir"
                  placeholder="dist"
                  value={outputDirectory}
                  onChange={(e) => setOutputDirectory(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-[#f8f9fb] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-deploy on Git Push</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically trigger builds when commits land via webhook.
                  </p>
                </div>
                <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
              </div>

              {selectedConnId ? (
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <p className="text-sm font-medium">Register GitHub Repository Webhook</p>
                    <p className="text-xs text-muted-foreground">
                      Calls GitHub API to attach a push webhook signed with HMAC-SHA256.
                    </p>
                  </div>
                  <Switch checked={registerWebhook} onCheckedChange={setRegisterWebhook} />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/projects">Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Create & Configure Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
