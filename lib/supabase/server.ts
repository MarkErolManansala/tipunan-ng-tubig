import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/env";
import type { Database } from "@/types/database.types";

/** Typed server-side Supabase client (schema `public`). */
export type AppSupabaseClient = SupabaseClient<Database, "public", "public">;

/**
 * Publishable-key client: public reads, constrained by RLS.
 * Safe to reference from server code serving public data.
 */
export function createPublicSupabaseClient(): AppSupabaseClient {
  return createClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Secret-key client: server-side sync writes; bypasses RLS.
 * Create it only inside server-side code paths and never pass the client or
 * its key into client components.
 */
export function createSecretSupabaseClient(): AppSupabaseClient {
  return createClient<Database>(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
