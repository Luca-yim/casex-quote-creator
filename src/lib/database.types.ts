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
          vertical_other_detail: string | null
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
          migration_required: boolean | null
          migration_volume_range: string | null
          migration_cleanup_required: boolean | null
          external_idp_required: boolean | null
          worker_idp_required: boolean | null
          idp_documented: boolean | null
          portal_form_count_range: string | null
          support_tier: string | null
          margin_percent: number
          contingency_pct: number
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
          vertical_other_detail?: string | null
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
          migration_required?: boolean | null
          migration_volume_range?: string | null
          migration_cleanup_required?: boolean | null
          external_idp_required?: boolean | null
          worker_idp_required?: boolean | null
          idp_documented?: boolean | null
          portal_form_count_range?: string | null
          support_tier?: string | null
          margin_percent?: number
          contingency_pct?: number
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
          vertical_other_detail?: string | null
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
          migration_required?: boolean | null
          migration_volume_range?: string | null
          migration_cleanup_required?: boolean | null
          external_idp_required?: boolean | null
          worker_idp_required?: boolean | null
          idp_documented?: boolean | null
          portal_form_count_range?: string | null
          support_tier?: string | null
          margin_percent?: number
          contingency_pct?: number
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
      ballpark_sizing_reference: {
        Row: {
          tier: number
          tier_label: string | null
          hours_low: number
          hours_high: number
          commercial_rate_low: number
          commercial_rate_high: number
          public_sector_rate_low: number
          public_sector_rate_high: number
        }
        Insert: {
          tier: number
          tier_label?: string | null
          hours_low: number
          hours_high: number
          commercial_rate_low: number
          commercial_rate_high: number
          public_sector_rate_low: number
          public_sector_rate_high: number
        }
        Update: {
          tier?: number
          tier_label?: string | null
          hours_low?: number
          hours_high?: number
          commercial_rate_low?: number
          commercial_rate_high?: number
          public_sector_rate_low?: number
          public_sector_rate_high?: number
        }
        Relationships: []
      }
      quote_wbs_lines: {
        Row: {
          id: string
          quote_id: string
          phase: string
          area: string | null
          role: string
          location: string
          cost_hours: number
          revenue_hours: number
          cost_rate: number
          bill_rate: number
          person_days: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          quote_id: string
          phase: string
          area?: string | null
          role: string
          location: string
          cost_hours: number
          revenue_hours: number
          cost_rate: number
          bill_rate: number
        }
        Update: {
          phase?: string
          area?: string | null
          role?: string
          location?: string
          cost_hours?: number
          revenue_hours?: number
          cost_rate?: number
          bill_rate?: number
        }
        Relationships: []
      }
      quote_cost_items: {
        Row: {
          id: string
          quote_id: string
          name: string
          cost_type: string
          amount: number
          is_customer_visible: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          quote_id: string
          name: string
          cost_type: string
          amount: number
          is_customer_visible?: boolean
        }
        Update: {
          name?: string
          cost_type?: string
          amount?: number
          is_customer_visible?: boolean
        }
        Relationships: []
      }
      rate_cards: {
        Row: {
          id: string
          program_type: string
          role: string
          location: string
          bill_rate: number
          cost_rate: number
          effective_start: string | null
          effective_end: string | null
        }
        Insert: {
          id?: string
          program_type: string
          role: string
          location: string
          bill_rate: number
          cost_rate: number
          effective_start?: string | null
          effective_end?: string | null
        }
        Update: {
          program_type?: string
          role?: string
          location?: string
          bill_rate?: number
          cost_rate?: number
          effective_start?: string | null
          effective_end?: string | null
        }
        Relationships: []
      }
      phase_weight_allocation: {
        Row: {
          id: number
          phase_name: string
          weight_percent: number | null
          display_order: number | null
        }
        Insert: {
          id?: number
          phase_name: string
          weight_percent?: number | null
          display_order?: number | null
        }
        Update: {
          phase_name?: string
          weight_percent?: number | null
          display_order?: number | null
        }
        Relationships: []
      }
      lead_intakes: {
        Row: {
          id: string
          lead_number: string | null
          submitted_by_anon_id: string | null
          organization_name: string
          contact_name: string
          contact_email: string
          contact_phone: string | null
          region: string | null
          vertical: string | null
          vertical_other_detail: string | null
          solution: string | null
          internal_user_range: string | null
          external_portal_required: boolean | null
          external_portal_monthly_logins_range: string | null
          b2b_portal_required: boolean | null
          b2b_user_count_range: string | null
          hosting_preference: string | null
          compliance_requirements: string[] | null
          integration_required: boolean | null
          integration_count_range: string | null
          integration_difficulty: string | null
          additional_notes: string | null
          status: string
          lead_score: number | null
          lead_score_label: string | null
          confidence_pct: number | null
          duplicate_of_lead_id: string | null
          assigned_rep_id: string | null
          claimed_by: string | null
          claimed_at: string | null
          converted_quote_id: string | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          submitted_by_anon_id?: string | null
          organization_name: string
          contact_name: string
          contact_email: string
          contact_phone?: string | null
          region?: string | null
          vertical?: string | null
          vertical_other_detail?: string | null
          solution?: string | null
          internal_user_range?: string | null
          external_portal_required?: boolean | null
          external_portal_monthly_logins_range?: string | null
          b2b_portal_required?: boolean | null
          b2b_user_count_range?: string | null
          hosting_preference?: string | null
          compliance_requirements?: string[] | null
          integration_required?: boolean | null
          integration_count_range?: string | null
          integration_difficulty?: string | null
          additional_notes?: string | null
        }
        Update: {
          organization_name?: string
          contact_name?: string
          contact_email?: string
          contact_phone?: string | null
          region?: string | null
          additional_notes?: string | null
          status?: string
          assigned_rep_id?: string | null
          claimed_by?: string | null
          claimed_at?: string | null
          duplicate_of_lead_id?: string | null
          converted_quote_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      /**
       * Row shape returned by the read-only `public.quotes_scoped()` function.
       * Pricing columns are nulled out for roles that must not see them; all
       * writes still target the base `quotes` table.
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
          vertical_other_detail: string | null
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
          migration_required: boolean | null
          migration_volume_range: string | null
          migration_cleanup_required: boolean | null
          external_idp_required: boolean | null
          worker_idp_required: boolean | null
          idp_documented: boolean | null
          portal_form_count_range: string | null
          support_tier: string | null
          margin_percent: number | null
          contingency_pct: number
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

      /**
       * Row shape returned by the read-only `public.quote_versions_scoped()`
       * function: the same columns as `quote_versions`, with pricing keys
       * removed from the `snapshot` jsonb for roles that must not see them.
       */
      quote_versions_scoped: {
        Row: {
          id: string
          quote_id: string
          version_number: number
          snapshot: Json
          change_reason: string | null
          changed_by: string | null
          changed_at: string
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
      /**
       * Role-aware, read-only projection of `public.quote_versions`, returning
       * `setof public.quote_versions` with pricing keys stripped from the
       * snapshot jsonb for roles that must not see them.
       */
      quote_versions_scoped: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Views"]["quote_versions_scoped"]["Row"][]
      }
      /**
       * Server-side state machine for quotes. Validates the requested
       * transition against the caller's role and the current state, and is
       * the only supported way to change `public.quotes.state`.
       */
      transition_quote: {
        Args: {
          p_quote_id: string
          p_new_state: Database["public"]["Tables"]["quotes"]["Row"]["state"]
        }
        Returns: Database["public"]["Tables"]["quotes"]["Row"]
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
