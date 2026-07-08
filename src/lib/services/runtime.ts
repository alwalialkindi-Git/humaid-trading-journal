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
 */
export async function createServices(userClient?: SupabaseClient): Promise<Services> {
  const db = userClient ?? (await createClient());
  const admin = createAdminClient();
  return buildServices(new SupabaseRepository(db, admin));
}
