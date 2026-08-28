import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Typed Supabase client for the external project `lsmrxbpvmvrzpbtjqygh`.
 *
 * The publishable key is read from VITE_APP_SUPABASE_PUBLISHABLE_KEY
 * (or APP_SUPABASE_PUBLISHABLE_KEY on the server).
 *
 * These deliberately do NOT use the plain VITE_SUPABASE_* names: those are
 * auto-generated for the built-in Lovable Cloud backend and get rewritten,
 * which would silently repoint this client at the wrong project.
 */
const SUPABASE_URL =
  (import.meta.env['VITE_APP_SUPABASE_URL'] as string | undefined) ??
  "https://lsmrxbpvmvrzpbtjqygh.supabase.co";

/**
 * Publishable (anon) key for the app project. There is deliberately NO
 * hardcoded fallback: a key committed to source cannot be rotated after an
 * exposure, so it must always come from the environment.
 */
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env['VITE_APP_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ??
  (import.meta.env['APP_SUPABASE_PUBLISHABLE_KEY'] as string | undefined);

export type TypedSupabaseClient = SupabaseClient<Database>;

let _client: TypedSupabaseClient | undefined;

function createTypedClient(): TypedSupabaseClient {
  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing VITE_APP_SUPABASE_PUBLISHABLE_KEY. Add your Supabase publishable " +
        "key (sb_publishable_...) to .env / your environment settings.",
    );
  }


  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      ...(typeof window !== "undefined" ? { storage: window.localStorage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/** Lazily instantiated so a missing key surfaces at call time, not import time. */
export const supabase = new Proxy({} as TypedSupabaseClient, {
  get(_target, prop, receiver) {
    if (!_client) _client = createTypedClient();
    return Reflect.get(_client, prop, receiver);
  },
});

export const isSupabaseConfigured = Boolean(SUPABASE_PUBLISHABLE_KEY);
export const supabaseUrl = SUPABASE_URL;
