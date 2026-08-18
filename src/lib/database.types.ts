/**
 * Supabase schema types for the external project `lsmrxbpvmvrzpbtjqygh`.
 *
 * NOTE: These are provisional. Full generation (`supabase gen types typescript`)
 * requires the service role key or the database connection string, which is not
 * available yet. The tables below were discovered by probing the Data API with
 * the anon key; column shapes are intentionally permissive until types can be
 * generated from the real schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UnknownRow = Record<string, Json | undefined>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: UnknownRow;
        Insert: UnknownRow;
        Update: UnknownRow;
        Relationships: [];
      };
      quotes: {
        Row: UnknownRow;
        Insert: UnknownRow;
        Update: UnknownRow;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
