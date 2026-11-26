import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function requirePageUser() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function requireApiUser() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return {
      supabase,
      user: null,
      unauthorizedResponse: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { supabase, user, unauthorizedResponse: null };
}
