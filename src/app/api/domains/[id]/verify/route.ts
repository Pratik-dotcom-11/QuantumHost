import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { resolveRequestAppUrl } from "@/lib/env";
import { verifyDomainAndSsl } from "@/lib/hosting/domains";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { invalidUuidResponse, isValidUuid } from "@/lib/security/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isValidUuid(id)) return invalidUuidResponse("domain");
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const rl = checkRateLimit(`domain-verify:${user.id}`, 20, 60_000);
  if (!rl.allowed) return rateLimitExceededResponse(rl);

  const { data: domainRow } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!domainRow) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const appUrl = resolveRequestAppUrl(request);
  const outcome = await verifyDomainAndSsl({
    domain: domainRow.domain,
    verificationToken: domainRow.verification_token,
    appUrl,
    provider: domainRow.provider,
    providerHostnameId: domainRow.provider_hostname_id,
  });

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("custom_domains")
    .update({
      provider: outcome.provider,
      provider_hostname_id: outcome.providerHostnameId,
      verification_status: outcome.verificationStatus,
      ssl_status: outcome.sslStatus,
      https_verified: outcome.httpsVerified,
      https_status_code: outcome.httpsStatusCode,
      verification_error: outcome.verificationError,
      ...(outcome.dnsRecords ? { dns_records: outcome.dnsRecords } : {}),
      last_checked_at: now,
      last_https_checked_at: now,
      verified_at: outcome.verificationStatus === "verified" ? domainRow.verified_at ?? now : domainRow.verified_at,
    })
    .eq("id", domainRow.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    domain: updated,
    diagnostics: outcome.diagnostics,
  });
}
