import Link from "next/link";
import { ArrowUpRight, Rocket } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/utils";
import { DeploymentStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: deployments }, { data: projects }] = await Promise.all([
    supabase
      .from("deployments")
      .select(
        "id, project_id, deployment_number, status, environment, trigger_source, git_branch, git_commit_message, artifact_size_bytes, build_duration_ms, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("projects").select("id, name, slug").eq("user_id", user.id),
  ]);

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
          Deployments
        </h1>
        <p className="mt-1 text-sm text-[#9a9084]">
          Global build history, artifacts, durations, and live preview links.
        </p>
      </div>

      {!deployments?.length ? (
        <EmptyState
          icon={Rocket}
          title="No deployments recorded"
          description="Open a project and trigger a build or connect a GitHub webhook to start deploying."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
            <CardDescription>Showing latest 50 deployment jobs</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#26201a] text-xs uppercase text-[#9a9084]">
                <tr>
                  <th className="pb-3 pr-4">Deployment</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Branch</th>
                  <th className="pb-3 pr-4">Duration</th>
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#221c16]">
                {deployments.map((dep) => {
                  const proj = projectMap.get(dep.project_id);
                  return (
                    <tr key={dep.id} className="hover:bg-[#191410]">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/deployments/${dep.id}`}
                          className="font-medium text-[#f7f3ec] hover:text-[#f4ba4a]"
                        >
                          {proj?.name || "Project"}{" "}
                          <span className="font-mono text-xs text-[#9a9084]">
                            #{dep.deployment_number}
                          </span>
                        </Link>
                        <p className="max-w-xs truncate text-xs text-[#9a9084]">
                          {dep.git_commit_message || dep.trigger_source}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <DeploymentStatusBadge status={dep.status} />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#d7cfc3]">
                        {dep.git_branch || "main"}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#9a9084]">
                        {formatDuration(dep.build_duration_ms)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#9a9084]">
                        {formatBytes(dep.artifact_size_bytes)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#9a9084]">
                        {formatRelativeTime(dep.created_at)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/deployments/${dep.id}`}
                            className="text-xs font-medium text-[#f4ba4a] hover:underline"
                          >
                            Logs
                          </Link>
                          {dep.status === "ready" ? (
                            <Link
                              href={`/d/${dep.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-0.5 text-xs text-[#9a9084] hover:text-[#f7f3ec]"
                            >
                              Preview
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
