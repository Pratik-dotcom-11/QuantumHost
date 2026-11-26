import { resolveCname, resolveTxt } from "node:dns/promises";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data: domainRow } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!domainRow) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const { appUrl } = getPublicEnv();
  const expectedHost = new URL(appUrl).hostname;
  const txtTargets = [`_quantumhost.${domainRow.domain}`, domainRow.domain];

  let txtMatched = false;
  const observedTxt: string[] = [];

  for (const host of txtTargets) {
    try {
      const records = await resolveTxt(host);
      for (const chunks of records) {
        const flat = chunks.join("");
        observedTxt.push(`${host}: ${flat}`);
        if (flat.includes(domainRow.verification_token)) {
          txtMatched = true;
        }
      }
    } catch {
      // Host may not have TXT records yet
    }
  }

  let cnameMatched = false;
  const observedCname: string[] = [];
  try {
    const cnames = await resolveCname(domainRow.domain);
    observedCname.push(...cnames);
    cnameMatched = cnames.some(
      (c) =>
        c.toLowerCase().includes("quantumhost") ||
        (expectedHost !== "localhost" && c.toLowerCase() === expectedHost.toLowerCase())
    );
  } catch {
    // No CNAME found
  }

  const isVerified = txtMatched;
  const verificationStatus = isVerified ? "verified" : "failed";
  const sslStatus = isVerified ? "active" : "pending";
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("custom_domains")
    .update({
      verification_status: verificationStatus,
      ssl_status: sslStatus,
      last_checked_at: now,
      verified_at: isVerified ? now : domainRow.verified_at,
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
    diagnostics: {
      txtMatched,
      cnameMatched,
      observedTxt,
      observedCname,
    },
  });
}
