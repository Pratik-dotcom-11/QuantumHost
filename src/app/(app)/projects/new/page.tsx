import { requirePageUser } from "@/lib/auth";
import { NewProjectWizard } from "@/components/projects/new-project-wizard";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const { supabase, user } = await requirePageUser();

  const { data: connections } = await supabase
    .from("github_connections")
    .select("id, provider_type, github_login")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import New Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a repository, detect its framework, and configure build parameters.
        </p>
      </div>
      <NewProjectWizard connections={connections ?? []} />
    </div>
  );
}
