import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Typed Supabase client for the project's own Supabase instance.
 *
 * URL and publishable (anon) key can be overridden with
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (or the
 * non-prefixed SUPABASE_PUBLISHABLE_KEY on the server). The URL and key
 * are only taken from the environment as a matching pair, so a stale
 * value from another project can't be mixed in.
 */
const DEFAULT_SUPABASE_URL = "https://lsmrxbpvmvrzpbtjqygh.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbXJ4YnB2bXZyenBidGpxeWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjE0NDYsImV4cCI6MjEwMjYzNzQ0Nn0.4kz3ho9thrJFEKzlkP6ttkl3O0IKCeLaLttU7JVY6jI";

const envUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const envKey =
  (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ??
  (import.meta.env['SUPABASE_PUBLISHABLE_KEY'] as string | undefined);

const usePair = Boolean(envUrl && envKey && envUrl === DEFAULT_SUPABASE_URL);

const SUPABASE_URL = usePair ? (envUrl as string) : DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = usePair
  ? (envKey as string)
  : DEFAULT_SUPABASE_PUBLISHABLE_KEY;


export type TypedSupabaseClient = SupabaseClient<Database>;

let _client: TypedSupabaseClient | undefined;

function createTypedClient(): TypedSupabaseClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
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
