import Link from "next/link";
import { ArrowUpRight, Boxes, GitBranch, Globe, Plus, Settings2 } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";
import { buildDeploymentHostingUrls } from "@/lib/hosting/urls";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SpotlightCard,
  StaggerGroup,
  StaggerItem,
} from "@/components/motion/primitives";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: projects }, { data: domains }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, slug, framework, repo_full_name, default_branch, active_deployment_id, auto_deploy, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("custom_domains")
      .select("project_id, domain, verification_status, ssl_status")
      .eq("user_id", user.id),
  ]);

  const { appUrl } = getPublicEnv();
  const domainMap = new Map<string, Array<{ domain: string; verification_status: string; ssl_status: string }>>();
  for (const dom of domains ?? []) {
    const arr = domainMap.get(dom.project_id) ?? [];
    arr.push(dom);
    domainMap.set(dom.project_id, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
            Projects
          </h1>
          <p className="mt-1 text-sm text-[#9a9084]">
            Repositories configured for isolated builds, immutable releases, and global edge serving.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />
            Import Project
          </Link>
        </Button>
      </div>

      {!projects?.length ? (
        <EmptyState
          icon={Boxes}
          title="No projects imported yet"
          description="Import a repository from GitHub or configure a project manually to trigger your first build."
          action={
            <Button asChild size="sm">
              <Link href="/projects/new">Import Repository</Link>
            </Button>
          }
        />
      ) : (
        <StaggerGroup className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" viewport={false} stagger={0.055}>
          {projects.map((project) => {
            const urls = buildDeploymentHostingUrls({
              appUrl,
              slug: project.slug,
              deploymentId: project.active_deployment_id ?? project.id,
            });
            const projDomains = domainMap.get(project.id) ?? [];
            const activeCustom = projDomains.find(
              (d) => d.verification_status === "verified" && d.ssl_status === "active"
            );

            return (
              <StaggerItem key={project.id} className="flex">
                <SpotlightCard className="w-full">
                  <Card className="flex h-full flex-col justify-between border-0 bg-transparent shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            <Link href={`/projects/${project.id}`} className="hover:text-[#f4ba4a]">
                              {project.name}
                            </Link>
                          </CardTitle>
                          <p className="mt-1 truncate font-mono text-xs text-[#9a9084]">
                            {activeCustom ? activeCustom.domain : urls.productionUrl}
                          </p>
                        </div>
                        <Badge variant="secondary">{project.framework}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-xl border border-[#26201a] bg-[#0f0c0a] p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-mono text-[#d7cfc3]">
                          <GitBranch className="h-3.5 w-3.5 text-[#f4ba4a]" />
                          <span className="truncate">
                            {project.repo_full_name || "No repository linked"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#9a9084]">
                          <span>Branch: {project.default_branch}</span>
                          <span>Updated {formatRelativeTime(project.updated_at)}</span>
                        </div>
                        {projDomains.length > 0 ? (
                          <div className="mt-2 flex items-center gap-1.5 border-t border-[#221c16] pt-2 text-[11px] text-[#d7cfc3]">
                            <Globe className="h-3 w-3 text-[#f4ba4a]" />
                            <span className="truncate">
                              {projDomains.length} custom domain{projDomains.length > 1 ? "s" : ""}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Button asChild variant="secondary" size="sm" className="flex-1">
                          <Link href={`/projects/${project.id}`}>
                            <Settings2 className="h-3.5 w-3.5" />
                            Manage
                          </Link>
                        </Button>
                        {project.active_deployment_id ? (
                          <Button asChild variant="outline" size="sm" className="flex-1">
                            <Link href={urls.fallbackProductionUrl} target="_blank">
                              Live Site
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </SpotlightCard>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      )}
    </div>
  );
}
