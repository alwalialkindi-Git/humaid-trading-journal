import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) Supabase client — SERVER-SIDE ONLY.
 *
 * SECURITY:
 * - `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It must exist only as a server
 *   env var (never `NEXT_PUBLIC_*`) and this module must never be imported
 *   from a client component.
 * - Used exclusively for the two surfaces the design allows (M1 doc §1.2,
 *   §1.8): writes to the global `assets` instrument master, and writes to
 *   the derived `positions` cache. Everything else goes through the
 *   user-scoped client under RLS.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set " +
        "for server-side asset/position writes. See .env.example."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
