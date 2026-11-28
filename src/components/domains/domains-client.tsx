"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface ProjectOption {
  id: string;
  name: string;
  slug: string;
  active_deployment_id?: string | null;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose?: string;
}

interface CustomDomainRow {
  id: string;
  project_id: string;
  domain: string;
  provider?: string;
  provider_hostname_id?: string | null;
  verification_token: string;
  verification_status: string;
  ssl_status: string;
  https_verified?: boolean;
  https_status_code?: number | null;
  verification_error?: string | null;
  dns_records: DnsRecord[];
  last_checked_at: string | null;
  last_https_checked_at?: string | null;
  verified_at: string | null;
}

export function DomainsClient({
  projects,
  initialDomains,
}: {
  projects: ProjectOption[];
  initialDomains: CustomDomainRow[];
}) {
  const { toast } = useToast();
  const [domains, setDomains] = useState<CustomDomainRow[]>(initialDomains);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [domainInput, setDomainInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setCreating(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, domain: domainInput.trim().toLowerCase() }),
      });
      const json = (await res.json()) as { domain?: CustomDomainRow; error?: string };
      if (!res.ok || !json.domain) throw new Error(json.error || "Failed to add domain");
      setDomains((prev) => [json.domain!, ...prev]);
      setDomainInput("");
      toast({
        title: "Custom domain registered",
        description: `Configure DNS records for ${json.domain.domain} and run Verify DNS & SSL.`,
        variant: "success",
      });
      setFeedback({
        type: "ok",
        text: "Domain attached. Configure the DNS records below, then click Verify DNS & SSL.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add domain";
      toast({ title: "Failed to add domain", description: msg, variant: "error" });
      setFeedback({ type: "err", text: msg });
    } finally {
      setCreating(false);
    }
  }

  async function handleVerify(id: string) {
    setFeedback(null);
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
      const json = (await res.json()) as {
        domain?: CustomDomainRow;
        error?: string;
      };
      if (!res.ok || !json.domain) throw new Error(json.error || "Verification check failed");
      setDomains((prev) => prev.map((d) => (d.id === id ? json.domain! : d)));

      const verified = json.domain.verification_status === "verified";
      const sslActive = json.domain.ssl_status === "active";

      setFeedback({
        type: verified ? "ok" : "err",
        text: verified && sslActive
          ? `${json.domain.domain} verified and HTTPS/TLS is active.`
          : verified
          ? `${json.domain.domain} ownership verified; TLS status is ${json.domain.ssl_status}. ${json.domain.verification_error || ""}`
          : json.domain.verification_error ||
            `DNS verification failed for ${json.domain.domain}. Check your DNS records and retry.`,
      });
    } catch (err) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "DNS check failed",
      });
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/domains?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setDomains((prev) => prev.filter((d) => d.id !== id));
        toast({ title: "Domain removed", description: "Custom domain and edge binding removed." });
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attach Custom Domain</CardTitle>
          <CardDescription>
            Bind an external hostname to any QuantumHost project, inspect DNS records, and verify ownership + SSL/TLS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a project first before attaching custom domains.
            </p>
          ) : (
            <form onSubmit={handleAddDomain} className="grid gap-4 sm:grid-cols-5 sm:items-end">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dom-proj">Project</Label>
                <Select
                  id="dom-proj"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (/sites/{p.slug})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dom-name">Domain Name</Label>
                <Input
                  id="dom-name"
                  placeholder="app.yourdomain.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={creating} className="sm:col-span-1">
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Domain
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

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

      {domains.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No custom domains configured"
          description="Add a domain above to generate DNS verification records and enable custom domain routing."
        />
      ) : (
        <div className="space-y-4">
          {domains.map((dom) => {
            const proj = projectMap.get(dom.project_id);
            const records = Array.isArray(dom.dns_records) ? dom.dns_records : [];
            const sslVariant =
              dom.ssl_status === "active"
                ? "success"
                : dom.ssl_status === "provisioning"
                ? "warning"
                : dom.ssl_status === "error"
                ? "destructive"
                : "secondary";

            return (
              <Card key={dom.id}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-mono text-base">{dom.domain}</CardTitle>
                      <Badge
                        variant={
                          dom.verification_status === "verified"
                            ? "success"
                            : dom.verification_status === "failed"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        DNS: {dom.verification_status}
                      </Badge>
                      <Badge variant={sslVariant}>
                        <ShieldCheck className="h-3 w-3" />
                        TLS: {dom.ssl_status}
                      </Badge>
                      {dom.https_verified ? (
                        <Badge variant="success">
                          <Lock className="h-3 w-3" />
                          HTTPS Verified{dom.https_status_code ? ` (${dom.https_status_code})` : ""}
                        </Badge>
                      ) : null}
                      {dom.provider ? (
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                          {dom.provider}
                        </span>
                      ) : null}
                    </div>
                    <CardDescription className="mt-1">
                      Project: {proj?.name || "Unknown"} · Last checked:{" "}
                      {formatRelativeTime(dom.last_checked_at)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {dom.verification_status === "verified" && dom.https_verified ? (
                      <Button asChild variant="secondary" size="sm">
                        <a href={`https://${dom.domain}`} target="_blank" rel="noreferrer">
                          Open
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(dom.id)}
                      disabled={verifyingId === dom.id}
                    >
                      {verifyingId === dom.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Verify DNS &amp; SSL
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(dom.id)}
                      disabled={deletingId === dom.id}
                      aria-label={`Remove ${dom.domain}`}
                    >
                      {deletingId === dom.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-rose-400" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dom.verification_error ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span>{dom.verification_error}</span>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="border-b border-[#26201a] text-[#9a9084]">
                        <tr>
                          <th className="pb-2 pr-4">Type</th>
                          <th className="pb-2 pr-4">Host / Name</th>
                          <th className="pb-2 pr-4">Value</th>
                          <th className="pb-2">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#221c16]">
                        {records.map((rec, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-4 font-semibold text-[#f4ba4a]">{rec.type}</td>
                            <td className="py-2 pr-4 text-[#f7f3ec]">{rec.name}</td>
                            <td className="py-2 pr-4 break-all text-[#9a9084]">{rec.value}</td>
                            <td className="py-2 text-[#9a9084]">{rec.purpose || "Routing"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
