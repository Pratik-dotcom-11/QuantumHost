import { requirePageUser } from "@/lib/auth";
import { DomainsClient } from "@/components/domains/domains-client";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const { supabase, user } = await requirePageUser();

  const [{ data: projects }, { data: domains }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug, active_deployment_id")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("custom_domains")
      .select(
        "id, project_id, domain, provider, provider_hostname_id, verification_token, verification_status, ssl_status, https_verified, https_status_code, verification_error, dns_records, last_checked_at, last_https_checked_at, verified_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-[-0.025em] text-[#f7f3ec]">
          Custom Domains
        </h1>
        <p className="mt-1 text-sm text-[#9a9084]">
          Attach hostnames, inspect DNS verification records, and monitor live TLS &amp; HTTPS provisioning.
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
