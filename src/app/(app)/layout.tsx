import React from "react";
import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requirePageUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const userName =
    profile?.full_name ||
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ||
    user.email?.split("@")[0] ||
    "Developer";

  return (
    <AppShell
      userEmail={profile?.email || user.email || "unknown"}
      userName={userName}
    >
      {children}
    </AppShell>
  );
}
