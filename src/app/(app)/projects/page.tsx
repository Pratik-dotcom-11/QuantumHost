import Link from "next/link";
import { ArrowUpRight, Boxes, GitBranch, Plus, Settings2 } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { supabase, user } = await requirePageUser();

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, slug, framework, repo_full_name, default_branch, active_deployment_id, auto_deploy, updated_at"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
            Projects
          </h1>
          <p className="mt-1 text-sm text-[#9a9084]">
            Repositories configured for isolated builds and global artifact serving.
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      <Link href={`/projects/${project.id}`} className="hover:text-[#f4ba4a]">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 truncate font-mono text-xs text-[#9a9084]">
                      /sites/{project.slug}
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
                      <Link href={`/sites/${project.slug}`} target="_blank">
                        Live Site
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
