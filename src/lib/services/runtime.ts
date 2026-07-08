import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseRepository } from "./supabase-repository";
import { buildServices, type Services } from "./index";

/**
 * Runtime service factory — SERVER-SIDE ONLY (route handlers, server
 * components, server actions). Combines the caller's RLS-scoped client with
 * the admin client for the two service-role surfaces (global `assets`
 * writes, `positions` cache writes).
 *
 * The admin client is created LAZILY on first use: read-only paths (listing
 * portfolios/positions) work even when SUPABASE_SERVICE_ROLE_KEY isn't set;
 * only the first admin write throws the descriptive configuration error.
 */
function lazyAdminClient(): SupabaseClient {
  let instance: SupabaseClient | null = null;
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      instance ??= createAdminClient();
      const value = instance[prop as keyof SupabaseClient];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export async function createServices(userClient?: SupabaseClient): Promise<Services> {
  const db = userClient ?? (await createClient());
  return buildServices(new SupabaseRepository(db, lazyAdminClient()));
}
