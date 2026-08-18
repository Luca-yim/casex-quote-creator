import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Typed Supabase client for the project's own Supabase instance.
 *
 * URL and anon key can be overridden with VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY; the defaults below are the publishable
 * (anon) credentials, which are safe to ship to the browser.
 */
const SUPABASE_URL =
  (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ??
  "https://lsmrxbpvmvrzpbtjqygh.supabase.co";

const SUPABASE_ANON_KEY =
  (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbXJ4YnB2bXZyenBidGpxeWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjE0NDYsImV4cCI6MjEwMjYzNzQ0Nn0.4kz3ho9thrJFEKzlkP6ttkl3O0IKCeLaLttU7JVY6jI";

export type TypedSupabaseClient = SupabaseClient<Database>;

let _client: TypedSupabaseClient | undefined;

function createTypedClient(): TypedSupabaseClient {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
