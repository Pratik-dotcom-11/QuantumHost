import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { isActiveDeploymentStatus } from "@/lib/deployments/lifecycle";
import { cancelQueuedJob } from "@/lib/queue/bullmq";
import { invalidUuidResponse, isValidUuid } from "@/lib/security/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isValidUuid(id)) return invalidUuidResponse("deployment");
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { searchParams } = new URL(request.url);
  const afterSeq = Number.parseInt(searchParams.get("afterSeq") || "0", 10) || 0;

  const { data: deployment, error } = await supabase
    .from("deployments")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  const { data: logs, error: logsError } = await supabase
    .from("deployment_logs")
    .select("id, seq, level, stage, message, created_at")
    .eq("deployment_id", id)
    .eq("user_id", user.id)
    .gt("seq", afterSeq)
    .order("seq", { ascending: true })
    .limit(500);

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  return NextResponse.json({ deployment, logs: logs ?? [] });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isValidUuid(id)) return invalidUuidResponse("deployment");
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse!;

  const { data: existing } = await supabase
    .from("deployments")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (!isActiveDeploymentStatus(existing.status)) {
    return NextResponse.json(
      { error: "Only active in-progress deployments can be cancelled." },
      { status: 400 }
    );
  }

  await cancelQueuedJob(id);

  const { error } = await supabase
    .from("deployments")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true });
}
