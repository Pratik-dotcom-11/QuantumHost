import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getPublicEnv, getServerSupabaseServiceKey } from "@/lib/env";

export function createAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const serviceKey = getServerSupabaseServiceKey();

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required on the server for background workers, webhooks, and administrative operations."
    );
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createPublicServerClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
