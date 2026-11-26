import { requirePageUser } from "@/lib/auth";
import { DomainsClient } from "@/components/domains/domains-client";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: projects }, { data: domains }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("custom_domains")
      .select(
        "id, project_id, domain, verification_token, verification_status, ssl_status, dns_records, last_checked_at, verified_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Custom Domains</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure DNS verification records and manage custom domain routing.
        </p>
      </div>
      <DomainsClient
        projects={projects ?? []}
        initialDomains={
          (domains ?? []) as unknown as Parameters<typeof DomainsClient>[0]["initialDomains"]
        }
      />
    </div>
  );
}
