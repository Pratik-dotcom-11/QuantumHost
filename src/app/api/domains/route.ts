import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";

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
      "id, project_id, domain, verification_token, verification_status, ssl_status, dns_records, last_checked_at, verified_at, created_at"
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
  const { appUrl } = getPublicEnv();
  const edgeHost = new URL(appUrl).hostname;

  const dnsRecords = [
    {
      type: "TXT",
      name: `_quantumhost.${parsed.data.domain}`,
      value: verificationToken,
    },
    {
      type: "CNAME",
      name: parsed.data.domain,
      value: edgeHost === "localhost" ? "cname.quantumhost.cloud" : edgeHost,
    },
  ];

  const { data: domain, error } = await supabase
    .from("custom_domains")
    .insert({
      project_id: project.id,
      user_id: user.id,
      domain: parsed.data.domain,
      verification_token: verificationToken,
      verification_status: "pending",
      ssl_status: "pending",
      dns_records: dnsRecords,
    })
    .select("*")
    .single();

  if (error) {
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
