import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { resolveRequestAppUrl } from "@/lib/env";
import { registerDomainWithProvider, removeDomainFromProvider } from "@/lib/hosting/domains";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { invalidUuidResponse, isValidUuid } from "@/lib/security/validation";

const createDomainSchema = z.object({
  projectId: z.string().uuid(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
      "Enter a valid fully qualified domain name (e.g., app.example.com)"
    ),
});

export async function GET() {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data, error } = await supabase
    .from("custom_domains")
    .select(
      "id, project_id, domain, provider, provider_hostname_id, verification_token, verification_status, ssl_status, https_verified, https_status_code, verification_error, dns_records, last_checked_at, last_https_checked_at, verified_at, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domains: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const rl = checkRateLimit(`domain-add:${user.id}`, 15, 60_000);
  if (!rl.allowed) return rateLimitExceededResponse(rl);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("id", parsed.data.projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const verificationToken = `qh-verify=${randomBytes(16).toString("hex")}`;
  const appUrl = resolveRequestAppUrl(request);

  const registration = await registerDomainWithProvider({
    domain: parsed.data.domain,
    projectId: project.id,
    projectSlug: project.slug,
    appUrl,
    verificationToken,
  });

  const { data: domain, error } = await supabase
    .from("custom_domains")
    .insert({
      project_id: project.id,
      user_id: user.id,
      domain: parsed.data.domain,
      provider: registration.provider,
      provider_hostname_id: registration.providerHostnameId,
      verification_token: verificationToken,
      verification_status: registration.verificationStatus,
      ssl_status: registration.sslStatus,
      https_verified: false,
      verification_error: registration.verificationError,
      dns_records: registration.dnsRecords,
    })
    .select("*")
    .single();

  if (error) {
    await removeDomainFromProvider(registration.provider, registration.providerHostnameId);
    const isConflict = error.code === "23505";
    return NextResponse.json(
      {
        error: isConflict
          ? `Domain "${parsed.data.domain}" is already registered.`
          : error.message,
      },
      { status: isConflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ domain }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Domain id is required" }, { status: 400 });
  }
  if (!isValidUuid(id)) return invalidUuidResponse("domain");

  const { data: existing } = await supabase
    .from("custom_domains")
    .select("id, provider, provider_hostname_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  await removeDomainFromProvider(existing.provider, existing.provider_hostname_id);

  const { error } = await supabase
    .from("custom_domains")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
