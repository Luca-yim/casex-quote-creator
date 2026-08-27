/**
 * Generated from the Supabase schema of project `lsmrxbpvmvrzpbtjqygh`
 * (public schema, via the Data API definition). Regenerate after schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      past_deployments: {
        Row: {
          id: number
          customer_name: string
          vertical_l1: string
          solution_l2: string
          deployment_year: number | null
          final_tcv: number | null
          status: string | null
          metadata: Json | null
        }
        Insert: {
          id: number
          customer_name: string
          vertical_l1: string
          solution_l2: string
          deployment_year?: number | null
          final_tcv?: number | null
          status?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: number
          customer_name?: string
          vertical_l1?: string
          solution_l2?: string
          deployment_year?: number | null
          final_tcv?: number | null
          status?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      pricing_catalog: {
        Row: {
          sku_id: string
          name: string
          category: string
          unit_price: number
          unit_type: string
          tier_range: string[] | null
          effective_date: string
          expiration_date: string | null
          metadata: Json | null
        }
        Insert: {
          sku_id: string
          name: string
          category: string
          unit_price: number
          unit_type: string
          tier_range?: string[] | null
          effective_date?: string
          expiration_date?: string | null
          metadata?: Json | null
        }
        Update: {
          sku_id?: string
          name?: string
          category?: string
          unit_price?: number
          unit_type?: string
          tier_range?: string[] | null
          effective_date?: string
          expiration_date?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      pricing_reviews: {
        Row: {
          id: string
          quote_id: string
          estimator_id: string
          original_snapshot: Json
          final_snapshot: Json
          adjustment_notes: string | null
          price_delta: number | null
          status: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          quote_id: string
          estimator_id: string
          original_snapshot: Json
          final_snapshot: Json
          adjustment_notes?: string | null
          price_delta?: number | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          quote_id?: string
          estimator_id?: string
          original_snapshot?: Json
          final_snapshot?: Json
          adjustment_notes?: string | null
          price_delta?: number | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_reviews_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_reviews_estimator_id_fkey"
            columns: ["estimator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      quote_comments: {
        Row: {
          id: string
          quote_id: string
          author_id: string
          author_role: string
          body: string
          visibility: string
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          author_id: string
          author_role: string
          body: string
          visibility?: string
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          author_id?: string
          author_role?: string
          body?: string
          visibility?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_comments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      quote_versions: {
        Row: {
          id: string
          quote_id: string
          version_number: number
          snapshot: Json
          change_reason: string | null
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          version_number: number
          snapshot: Json
          change_reason?: string | null
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          version_number?: number
          snapshot?: Json
          change_reason?: string | null
          changed_by?: string | null
          changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      quotes: {
        Row: {
          id: string
          owner_id: string | null
          requested_by: string
          reviewed_by: string | null
          last_reviewed_by: string | null
          approved_by: string | null
          name: string
          customer_name: string | null
          customer_type: string | null
          customer_email: string | null
          compliance: string[] | null
          vertical: string | null
          solution: string | null
          repeatable_activation: string
          module_tier: string | null
          contract_years: number
          target_go_live_date: string | null
          case_worker_count: number | null
          include_b2c: boolean
          b2c_mau: number | null
          include_b2b_portal: boolean
          b2b_user_count: number | null
          hosting_model: string | null
          environment_count: number
          has_integrations: boolean
          integration_count: number
          integration_difficulty: string | null
          support_tier: string | null
          margin_percent: number
          margin_justification: string | null
          rep_confidence: string | null
          tier: string
          state: string
          submitted_at: string | null
          approved_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          requested_by: string
          reviewed_by?: string | null
          last_reviewed_by?: string | null
          approved_by?: string | null
          name?: string
          customer_name?: string | null
          customer_type?: string | null
          customer_email?: string | null
          compliance?: string[] | null
          vertical?: string | null
          solution?: string | null
          repeatable_activation?: string
          module_tier?: string | null
          contract_years?: number
          target_go_live_date?: string | null
          case_worker_count?: number | null
          include_b2c?: boolean
          b2c_mau?: number | null
          include_b2b_portal?: boolean
          b2b_user_count?: number | null
          hosting_model?: string | null
          environment_count?: number
          has_integrations?: boolean
          integration_count?: number
          integration_difficulty?: string | null
          support_tier?: string | null
          margin_percent?: number
          margin_justification?: string | null
          rep_confidence?: string | null
          tier?: string
          state?: string
          submitted_at?: string | null
          approved_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          requested_by?: string
          reviewed_by?: string | null
          last_reviewed_by?: string | null
          approved_by?: string | null
          name?: string
          customer_name?: string | null
          customer_type?: string | null
          customer_email?: string | null
          compliance?: string[] | null
          vertical?: string | null
          solution?: string | null
          repeatable_activation?: string
          module_tier?: string | null
          contract_years?: number
          target_go_live_date?: string | null
          case_worker_count?: number | null
          include_b2c?: boolean
          b2c_mau?: number | null
          include_b2b_portal?: boolean
          b2b_user_count?: number | null
          hosting_model?: string | null
          environment_count?: number
          has_integrations?: boolean
          integration_count?: number
          integration_difficulty?: string | null
          support_tier?: string | null
          margin_percent?: number
          margin_justification?: string | null
          rep_confidence?: string | null
          tier?: string
          state?: string
          submitted_at?: string | null
          approved_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      vertical_solutions: {
        Row: {
          id: number
          vertical_l1: string
          solution_l2: string
          display_label: string
          is_active: boolean
          display_order: number
        }
        Insert: {
          id: number
          vertical_l1: string
          solution_l2: string
          display_label: string
          is_active?: boolean
          display_order?: number
        }
        Update: {
          id?: number
          vertical_l1?: string
          solution_l2?: string
          display_label?: string
          is_active?: boolean
          display_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      /**
       * Role-aware, read-only projection of `public.quotes`. Pricing columns
       * are nulled out for roles that must not see them, so every read path
       * uses this view while writes still target the base table.
       */
      quotes_scoped: {
        Row: {
          id: string
          owner_id: string | null
          requested_by: string
          reviewed_by: string | null
          last_reviewed_by: string | null
          approved_by: string | null
          name: string
          customer_name: string | null
          customer_type: string | null
          customer_email: string | null
          compliance: string[] | null
          vertical: string | null
          solution: string | null
          repeatable_activation: string
          module_tier: string | null
          contract_years: number
          target_go_live_date: string | null
          case_worker_count: number | null
          include_b2c: boolean
          b2c_mau: number | null
          include_b2b_portal: boolean
          b2b_user_count: number | null
          hosting_model: string | null
          environment_count: number
          has_integrations: boolean
          integration_count: number
          integration_difficulty: string | null
          support_tier: string | null
          margin_percent: number | null
          margin_justification: string | null
          rep_confidence: string | null
          tier: string
          state: string
          submitted_at: string | null
          approved_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
    }

    Functions: {
      /**
       * Role-aware, read-only projection of `public.quotes`, returning
       * `setof public.quotes` with pricing columns nulled out for roles that
       * must not see them. SECURITY DEFINER: it bypasses RLS, so its WHERE
       * clause must be kept in sync with the RLS policies on `quotes`.
       */
      quotes_scoped: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Views"]["quotes_scoped"]["Row"][]

      }
    }

    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
