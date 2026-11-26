"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Rocket,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { FRAMEWORK_PRESETS } from "@/lib/frameworks";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/utils";
import type { FrameworkType } from "@/types/database";
import { DeploymentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  framework: string;
  repo_full_name: string | null;
  repo_url: string | null;
  default_branch: string;
  root_directory: string;
  install_command: string;
  build_command: string;
  output_directory: string;
  node_version: string;
  auto_deploy: boolean;
  active_deployment_id: string | null;
}

interface DeploymentRow {
  id: string;
  deployment_number: number;
  status: string;
  environment: string;
  trigger_source: string;
  git_branch: string | null;
  git_commit_sha: string | null;
  git_commit_message: string | null;
  artifact_size_bytes: number;
  build_duration_ms: number | null;
  preview_url: string | null;
  created_at: string;
}

interface EnvVarItem {
  id: string;
  key: string;
  isSecret: boolean;
  environment: string;
  preview: string;
  updatedAt: string;
}

export function ProjectDetailClient({
  initialProject,
  initialDeployments,
  initialEnvVars,
}: {
  initialProject: ProjectRow;
  initialDeployments: DeploymentRow[];
  initialEnvVars: EnvVarItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [project, setProject] = useState(initialProject);
  const deployments = initialDeployments;
  const [envVars, setEnvVars] = useState(initialEnvVars);

  const [deploying, setDeploying] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Settings form state
  const [name, setName] = useState(project.name);
  const [framework, setFramework] = useState<FrameworkType>(project.framework as FrameworkType);
  const [defaultBranch, setDefaultBranch] = useState(project.default_branch);
  const [rootDirectory, setRootDirectory] = useState(project.root_directory);
  const [installCommand, setInstallCommand] = useState(project.install_command);
  const [buildCommand, setBuildCommand] = useState(project.build_command);
  const [outputDirectory, setOutputDirectory] = useState(project.output_directory);
  const [nodeVersion, setNodeVersion] = useState(project.node_version);
  const [autoDeploy, setAutoDeploy] = useState(project.auto_deploy);

  // Env var form state
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [envTarget, setEnvTarget] = useState<"production" | "preview" | "all">("production");
  const [envIsSecret, setEnvIsSecret] = useState(true);
  const [savingEnv, setSavingEnv] = useState(false);

  async function handleDeploy() {
    setFeedback(null);
    setDeploying(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          branch: project.default_branch,
          environment: "production",
        }),
      });
      const json = (await res.json()) as {
        deployment?: DeploymentRow;
        error?: string;
        deploymentId?: string;
      };
      if (!res.ok) {
        if (json.deploymentId) {
          router.push(`/deployments/${json.deploymentId}`);
          return;
        }
        throw new Error(json.error || "Failed to trigger deployment");
      }
      if (json.deployment) {
        router.push(`/deployments/${json.deployment.id}`);
      }
    } catch (err) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Deployment trigger failed",
      });
    } finally {
      setDeploying(false);
    }
  }

  async function handleRollback(deploymentId: string) {
    setFeedback(null);
    setRollingBackId(deploymentId);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/rollback`, {
        method: "POST",
      });
      const json = (await res.json()) as { activeDeploymentId?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Rollback failed");
      setProject((prev) => ({
        ...prev,
        active_deployment_id: json.activeDeploymentId ?? deploymentId,
      }));
      toast({
        title: "Rollback promoted",
        description: "Production route switched to selected artifact.",
        variant: "success",
      });
      setFeedback({ type: "ok", text: "Production route rolled back successfully." });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rollback failed";
      toast({ title: "Rollback failed", description: msg, variant: "error" });
      setFeedback({
        type: "err",
        text: msg,
      });
    } finally {
      setRollingBackId(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          framework,
          defaultBranch,
          rootDirectory,
          installCommand,
          buildCommand,
          outputDirectory,
          nodeVersion,
          autoDeploy,
        }),
      });
      const json = (await res.json()) as { project?: ProjectRow; error?: string };
      if (!res.ok || !json.project) {
        throw new Error(json.error || "Failed to save settings");
      }
      setProject(json.project);
      setFeedback({ type: "ok", text: "Project configuration saved." });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddEnv(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSavingEnv(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: envKey.trim().toUpperCase(),
          value: envValue,
          environment: envTarget,
          isSecret: envIsSecret,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save variable");

      const listRes = await fetch(`/api/projects/${project.id}/env`);
      const listJson = (await listRes.json()) as { variables?: EnvVarItem[] };
      if (listJson.variables) setEnvVars(listJson.variables);
      setEnvKey("");
      setEnvValue("");
      setFeedback({ type: "ok", text: "Environment variable encrypted and stored." });
    } catch (err) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to save variable",
      });
    } finally {
      setSavingEnv(false);
    }
  }

  async function handleDeleteEnv(varId: string) {
    const res = await fetch(`/api/projects/${project.id}/env?varId=${encodeURIComponent(varId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setEnvVars((prev) => prev.filter((v) => v.id !== varId));
    }
  }

  async function handleDeleteProject() {
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/projects");
        router.refresh();
      }
    } finally {
      setDeletingProject(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-[#1d5bff]">
              {project.framework}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {project.repo_full_name || "No repository"} · branch {project.default_branch} · route /sites/
            {project.slug}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {project.active_deployment_id ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/sites/${project.slug}`} target="_blank">
                Visit Live URL
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button onClick={handleDeploy} disabled={deploying} size="sm">
            {deploying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Deploy Now
          </Button>
        </div>
      </div>

      {feedback ? (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
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

      <Tabs defaultValue="deployments">
        <TabsList>
          <TabsTrigger value="deployments">Deployments ({deployments.length})</TabsTrigger>
          <TabsTrigger value="env">Environment Variables ({envVars.length})</TabsTrigger>
          <TabsTrigger value="settings">Build & Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                Inspect build logs, preview immutable builds, or roll back to any successful deployment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No deployments yet. Click <strong>Deploy Now</strong> to enqueue the first build.
                </p>
              ) : (
                <div className="space-y-3">
                  {deployments.map((dep) => {
                    const isActive = project.active_deployment_id === dep.id;
                    return (
                      <div
                        key={dep.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-[#f8f9fb] p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/deployments/${dep.id}`}
                              className="font-mono text-sm font-semibold text-foreground hover:text-[#1d5bff]"
                            >
                              #{dep.deployment_number}
                            </Link>
                            <DeploymentStatusBadge status={dep.status} />
                            {isActive ? (
                              <span className="rounded-full border border-[#1d5bff]/40 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#1d5bff]">
                                Current Production
                              </span>
                            ) : null}
                            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {dep.environment}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {dep.git_commit_message || `Triggered via ${dep.trigger_source}`} ·{" "}
                            {dep.git_branch || project.default_branch} ·{" "}
                            {formatDuration(dep.build_duration_ms)} ·{" "}
                            {formatBytes(dep.artifact_size_bytes)} ·{" "}
                            {formatRelativeTime(dep.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/deployments/${dep.id}`}>Build Logs</Link>
                          </Button>
                          {dep.status === "ready" && !isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRollback(dep.id)}
                              disabled={rollingBackId === dep.id}
                            >
                              {rollingBackId === dep.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Rollback
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="env">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#1d5bff]" />
                  Add Variable
                </CardTitle>
                <CardDescription>
                  Values are encrypted with AES-256-GCM before storage and injected only into build workers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddEnv} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="env-key">Key</Label>
                    <Input
                      id="env-key"
                      placeholder="NEXT_PUBLIC_API_URL"
                      value={envKey}
                      onChange={(e) => setEnvKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="env-val">Value</Label>
                    <Input
                      id="env-val"
                      type={envIsSecret ? "password" : "text"}
                      placeholder="Value"
                      value={envValue}
                      onChange={(e) => setEnvValue(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="env-target">Environment</Label>
                    <Select
                      id="env-target"
                      value={envTarget}
                      onChange={(e) =>
                        setEnvTarget(e.target.value as "production" | "preview" | "all")
                      }
                    >
                      <option value="production">Production</option>
                      <option value="preview">Preview</option>
                      <option value="all">All Environments</option>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Label htmlFor="env-secret">Mask value in UI</Label>
                    <Switch
                      id="env-secret"
                      checked={envIsSecret}
                      onCheckedChange={setEnvIsSecret}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={savingEnv}>
                    {savingEnv ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Variable
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Configured Variables</CardTitle>
                <CardDescription>Scoped secrets decrypted inside isolated build workers</CardDescription>
              </CardHeader>
              <CardContent>
                {envVars.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    No environment variables configured for this project.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {envVars.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-[#f8f9fb] px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {v.key}
                            </span>
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {v.environment}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {v.preview}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEnv(v.id)}
                          aria-label={`Delete ${v.key}`}
                        >
                          <Trash2 className="h-4 w-4 text-rose-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Build & Deployment Settings</CardTitle>
                <CardDescription>
                  Adjust commands and branch targeting for future builds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="set-name">Project Name</Label>
                      <Input
                        id="set-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="set-branch">Production Branch</Label>
                      <Input
                        id="set-branch"
                        value={defaultBranch}
                        onChange={(e) => setDefaultBranch(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="set-fw">Framework</Label>
                      <Select
                        id="set-fw"
                        value={framework}
                        onChange={(e) => setFramework(e.target.value as FrameworkType)}
                      >
                        {Object.values(FRAMEWORK_PRESETS).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="set-root">Root Directory</Label>
                      <Input
                        id="set-root"
                        value={rootDirectory}
                        onChange={(e) => setRootDirectory(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="set-node">Node.js Version</Label>
                      <Select
                        id="set-node"
                        value={nodeVersion}
                        onChange={(e) => setNodeVersion(e.target.value)}
                      >
                        <option value="20">Node 20</option>
                        <option value="22">Node 22</option>
                        <option value="24">Node 24</option>
                        <option value="18">Node 18</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="set-install">Install Command</Label>
                      <Input
                        id="set-install"
                        value={installCommand}
                        onChange={(e) => setInstallCommand(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="set-build">Build Command</Label>
                      <Input
                        id="set-build"
                        value={buildCommand}
                        onChange={(e) => setBuildCommand(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="set-out">Output Directory</Label>
                      <Input
                        id="set-out"
                        value={outputDirectory}
                        onChange={(e) => setOutputDirectory(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-[#f8f9fb] p-3.5">
                    <div>
                      <p className="text-sm font-medium">Auto-deploy on Git Push</p>
                      <p className="text-xs text-muted-foreground">
                        Trigger builds automatically when push webhooks arrive.
                      </p>
                    </div>
                    <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
                  </div>

                  <Button type="submit" disabled={savingSettings}>
                    {savingSettings ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Configuration
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-rose-500/30">
              <CardHeader>
                <CardTitle className="text-rose-300">Danger Zone</CardTitle>
                <CardDescription>
                  Permanently delete this project and its deployment history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={handleDeleteProject}
                  disabled={deletingProject}
                >
                  {deletingProject ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete Project
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
