import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Service-role client. It bypasses RLS, so it is only used where the storage
 * policies in `docs/schema.sql` cannot express what is needed: that bucket
 * grants INSERT but not UPDATE or DELETE, so replacing a product image has to
 * happen above the policy layer.
 *
 * Every caller must check ownership itself before reaching for this.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Copy .env.example to .env.local and fill it in.",
    );
  }

  return createSupabaseClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
