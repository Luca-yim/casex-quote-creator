import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Typed Supabase client for the project's backend.
 *
 * URL and publishable key come from VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY (falling back to the non-prefixed
 * SUPABASE_* names on the server). There are deliberately no hardcoded
 * fallbacks, so a stale key can never be baked into the bundle.
 */
const SUPABASE_URL =
  (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ??
  (import.meta.env['SUPABASE_URL'] as string | undefined);
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ??
  (import.meta.env['SUPABASE_PUBLISHABLE_KEY'] as string | undefined);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Supabase env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY",
  );
}
const supabaseUrl: string = SUPABASE_URL;
const supabaseKey: string = SUPABASE_PUBLISHABLE_KEY;

export type TypedSupabaseClient = SupabaseClient<Database>;

let _client: TypedSupabaseClient | undefined;

function createTypedClient(): TypedSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      ...(typeof window !== "undefined" ? { storage: window.localStorage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = new Proxy({} as TypedSupabaseClient, {
  get(_target, prop, receiver) {
    if (!_client) _client = createTypedClient();
    return Reflect.get(_client, prop, receiver);
  },
});
