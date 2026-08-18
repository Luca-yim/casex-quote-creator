/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Built-in Lovable Cloud backend (auto-generated, do not hand-edit). */
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;

  /** External Supabase project used by src/lib/supabase.ts. */
  readonly VITE_APP_SUPABASE_URL?: string;
  readonly VITE_APP_SUPABASE_PUBLISHABLE_KEY: string;
  readonly APP_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
