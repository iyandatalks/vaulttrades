import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for trusted automation.
 * Never import this module from browser/client components and never expose
 * SUPABASE_SERVICE_ROLE_KEY through NEXT_PUBLIC_* environment variables.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
