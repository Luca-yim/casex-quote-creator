/**
 * Generated from the live schema catalogue dump (enums_tables_functions_pasted.json).
 * Source: live quotes project public schema. Generated 2026-09-30 by mechanical
 * transform of the dump only; no hand-maintained content carried over.
 * quotes_scoped Returns: the 17 role-scoped (CASE-wrapped) fields are `| null`;
 * all other fields inherit nullability from the quotes table entry in the dump.
 * quote_versions_scoped Returns: no role-scoped nulls (snapshot has keys removed but
 * is never NULL); all seven fields inherit nullability from the quote_versions table.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      ballpark_sizing_reference: {
        Row: {
          commercial_rate_high: number
          commercial_rate_low: number
          hours_high: number
          hours_low: number
          id: string
          public_sector_rate_high: number
          public_sector_rate_low: number
          tier: number
          tier_label: string
          updated_at: string
        }
        Insert: {
          commercial_rate_high: number
          commercial_rate_low: number
          hours_high: number
          hours_low: number
          id?: string
          public_sector_rate_high: number
          public_sector_rate_low: number
          tier: number
          tier_label: string
          updated_at?: string
        }
        Update: {
          commercial_rate_high?: number
          commercial_rate_low?: number
          hours_high?: number
          hours_low?: number
          id?: string
          public_sector_rate_high?: number
          public_sector_rate_low?: number
          tier?: number
          tier_label?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      lead_intakes: {
        Row: {
          additional_notes: string | null
          assigned_rep_id: string | null
          b2b_portal_required: boolean | null
          b2b_user_count: number | null
          claimed_at: string | null
          claimed_by: string | null
          compliance_requirements: string[] | null
          confidence_pct: number | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          converted_quote_id: string | null
          created_at: string
          customer_type: string | null
          duplicate_of_lead_id: string | null
          external_portal_monthly_logins: number | null
          external_portal_required: boolean | null
          hosting_preference: string | null
          id: string
          integration_count: number | null
          integration_difficulty: string | null
          integration_required: boolean | null
          internal_user_count: number | null
          lead_number: string
          lead_score: number | null
          lead_score_label: string | null
          organization_name: string
          region: string | null
          solution: string | null
          status: string
          submitted_at: string
          submitted_by_anon_id: string | null
          updated_at: string
          vertical: string | null
          vertical_other_detail: string | null
        }
        Insert: {
          additional_notes?: string | null
          assigned_rep_id?: string | null
          b2b_portal_required?: boolean | null
          b2b_user_count?: number | null
          claimed_at?: string | null
          claimed_by?: string | null
          compliance_requirements?: string[] | null
          confidence_pct?: number | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          converted_quote_id?: string | null
          created_at?: string
          customer_type?: string | null
          duplicate_of_lead_id?: string | null
          external_portal_monthly_logins?: number | null
          external_portal_required?: boolean | null
          hosting_preference?: string | null
          id?: string
          integration_count?: number | null
          integration_difficulty?: string | null
          integration_required?: boolean | null
          internal_user_count?: number | null
          lead_number?: string
          lead_score?: number | null
          lead_score_label?: string | null
          organization_name: string
          region?: string | null
          solution?: string | null
          status?: string
          submitted_at?: string
          submitted_by_anon_id?: string | null
          updated_at?: string
          vertical?: string | null
          vertical_other_detail?: string | null
        }
        Update: {
          additional_notes?: string | null
          assigned_rep_id?: string | null
          b2b_portal_required?: boolean | null
          b2b_user_count?: number | null
          claimed_at?: string | null
          claimed_by?: string | null
          compliance_requirements?: string[] | null
          confidence_pct?: number | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          converted_quote_id?: string | null
          created_at?: string
          duplicate_of_lead_id?: string | null
          external_portal_monthly_logins?: number | null
          external_portal_required?: boolean | null
          hosting_preference?: string | null
          id?: string
          integration_count?: number | null
          integration_difficulty?: string | null
          integration_required?: boolean | null
          internal_user_count?: number | null
          lead_number?: string
          lead_score?: number | null
          lead_score_label?: string | null
          organization_name?: string
          region?: string | null
          solution?: string | null
          status?: string
          submitted_at?: string
          submitted_by_anon_id?: string | null
          updated_at?: string
          vertical?: string | null
          vertical_other_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_intakes_assigned_rep_id_fkey"
            columns: ["assigned_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intakes_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intakes_converted_quote_id_fkey"
            columns: ["converted_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intakes_duplicate_of_lead_id_fkey"
            columns: ["duplicate_of_lead_id"]
            isOneToOne: false
            referencedRelation: "lead_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          lead_id: string | null
          quote_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          quote_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          quote_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      past_deployments: {
        Row: {
          customer_name: string
          deployment_year: number | null
          final_tcv: number | null
          id: number
          metadata: Json | null
          solution_l2: string
          status: string | null
          vertical_l1: string
        }
        Insert: {
          customer_name: string
          deployment_year?: number | null
          final_tcv?: number | null
          id?: number
          metadata?: Json | null
          solution_l2: string
          status?: string | null
          vertical_l1: string
        }
        Update: {
          customer_name?: string
          deployment_year?: number | null
          final_tcv?: number | null
          id?: number
          metadata?: Json | null
          solution_l2?: string
          status?: string | null
          vertical_l1?: string
        }
        Relationships: [
        ]
      }
      phase_weight_allocation: {
        Row: {
          display_order: number
          id: string
          phase_name: string
          weight_pct: number
        }
        Insert: {
          display_order: number
          id?: string
          phase_name: string
          weight_pct: number
        }
        Update: {
          display_order?: number
          id?: string
          phase_name?: string
          weight_pct?: number
        }
        Relationships: [
        ]
      }
      pricing_catalog: {
        Row: {
          category: string
          effective_date: string
          expiration_date: string | null
          metadata: Json | null
          name: string
          naspo_discount_price: number | null
          sku_id: string
          tier_range: string[] | null
          unit_price: number
          unit_type: string
        }
        Insert: {
          category: string
          effective_date?: string
          expiration_date?: string | null
          metadata?: Json | null
          name: string
          naspo_discount_price?: number | null
          sku_id: string
          tier_range?: string[] | null
          unit_price: number
          unit_type: string
        }
        Update: {
          category?: string
          effective_date?: string
          expiration_date?: string | null
          metadata?: Json | null
          name?: string
          naspo_discount_price?: number | null
          sku_id?: string
          tier_range?: string[] | null
          unit_price?: number
          unit_type?: string
        }
        Relationships: [
        ]
      }
      pricing_reviews: {
        Row: {
          adjustment_notes: string | null
          completed_at: string | null
          created_at: string
          estimator_id: string
          final_snapshot: Json
          id: string
          original_snapshot: Json
          price_delta: number | null
          quote_id: string
          status: string
        }
        Insert: {
          adjustment_notes?: string | null
          completed_at?: string | null
          created_at?: string
          estimator_id: string
          final_snapshot: Json
          id?: string
          original_snapshot: Json
          price_delta?: number | null
          quote_id: string
          status?: string
        }
        Update: {
          adjustment_notes?: string | null
          completed_at?: string | null
          created_at?: string
          estimator_id?: string
          final_snapshot?: Json
          id?: string
          original_snapshot?: Json
          price_delta?: number | null
          quote_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_reviews_estimator_id_fkey"
            columns: ["estimator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_reviews_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_scenarios: {
        Row: {
          blended_cost_rate: number | null
          blended_revenue_rate: number | null
          computed_at: string
          id: string
          margin_pct: number
          quote_id: string
          revenue_price: number
          total_cost: number
        }
        Insert: {
          blended_cost_rate?: number | null
          blended_revenue_rate?: number | null
          computed_at?: string
          id?: string
          margin_pct: number
          quote_id: string
          revenue_price: number
          total_cost: number
        }
        Update: {
          blended_cost_rate?: number | null
          blended_revenue_rate?: number | null
          computed_at?: string
          id?: string
          margin_pct?: number
          quote_id?: string
          revenue_price?: number
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_scenarios_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_comments: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          quote_id: string
          visibility: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          id?: string
          quote_id: string
          visibility?: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          quote_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_comments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_cost_items: {
        Row: {
          amount: number
          cost_name: string
          cost_type: string
          created_at: string
          id: string
          is_customer_visible: boolean
          quote_id: string
        }
        Insert: {
          amount: number
          cost_name: string
          cost_type: string
          created_at?: string
          id?: string
          is_customer_visible?: boolean
          quote_id: string
        }
        Update: {
          amount?: number
          cost_name?: string
          cost_type?: string
          created_at?: string
          id?: string
          is_customer_visible?: boolean
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_cost_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_pdfs: {
        Row: {
          file_size_bytes: number | null
          generated_at: string
          generated_by: string
          id: string
          quote_id: string
          storage_path: string
          version: string
        }
        Insert: {
          file_size_bytes?: number | null
          generated_at?: string
          generated_by: string
          id?: string
          quote_id: string
          storage_path: string
          version: string
        }
        Update: {
          file_size_bytes?: number | null
          generated_at?: string
          generated_by?: string
          id?: string
          quote_id?: string
          storage_path?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_pdfs_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_pdfs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          id: string
          quote_id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          quote_id: string
          snapshot: Json
          version_number: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          quote_id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_wbs_lines: {
        Row: {
          area: string
          bill_rate: number
          cost_hours: number
          cost_rate: number
          created_at: string
          id: string
          location: string
          person_days: number | null
          phase: string
          quote_id: string
          revenue_hours: number
          role: string
          updated_at: string
        }
        Insert: {
          area: string
          bill_rate: number
          cost_hours?: number
          cost_rate: number
          created_at?: string
          id?: string
          location: string
          phase: string
          quote_id: string
          revenue_hours?: number
          role: string
          updated_at?: string
        }
        Update: {
          area?: string
          bill_rate?: number
          cost_hours?: number
          cost_rate?: number
          created_at?: string
          id?: string
          location?: string
          phase?: string
          quote_id?: string
          revenue_hours?: number
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_wbs_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          b2b_avg_users_per_org: number | null
          b2b_org_count: number | null
          b2b_user_count: number | null
          b2c_mau: number | null
          billing_preference: string | null
          billing_preference_other_detail: string | null
          case_worker_count: number | null
          case_worker_studio_users: number | null
          compliance: string[] | null
          contingency_pct: number | null
          contract_years: number
          converted_from_lead_id: string | null
          converted_from_lead_notes: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_type: string | null
          deal_priority: string
          deal_template: string | null
          environment_count: number
          expected_award_date: string | null
          expected_user_growth: string | null
          expected_user_growth_other_detail: string | null
          external_idp_required: boolean | null
          geographic_scope: string | null
          geographic_scope_other_detail: string | null
          has_integrations: boolean
          hosting_model: string | null
          id: string
          idp_documented: boolean | null
          include_b2b_portal: boolean
          include_b2c: boolean
          integration_count: number | null
          integration_difficulty: string | null
          integrations: Json
          last_reviewed_by: string | null
          lead_id: string | null
          margin_justification: string | null
          margin_percent: number | null
          migration_cleanup_required: boolean | null
          migration_required: boolean | null
          migration_volume_range: string | null
          module_tier: string | null
          name: string
          needs_attention: boolean
          opportunity_stage: string
          owner_id: string | null
          peak_load_multiplier: string | null
          peak_load_multiplier_other_detail: string | null
          portal_form_count_range: string | null
          pricing_schedule: string | null
          pricing_schedule_other_detail: string | null
          quote_validity_date: string | null
          rep_confidence: string | null
          repeatable_activation: string
          requested_by: string
          reviewed_by: string | null
          sent_at: string | null
          solution: string | null
          state: string
          submitted_at: string | null
          support_tier: string | null
          tier: string
          updated_at: string
          vertical: string | null
          vertical_other_detail: string | null
          worker_idp_required: boolean | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          b2b_avg_users_per_org?: number | null
          b2b_org_count?: number | null
          b2b_user_count?: number | null
          b2c_mau?: number | null
          billing_preference?: string | null
          billing_preference_other_detail?: string | null
          case_worker_count?: number | null
          case_worker_studio_users?: number | null
          compliance?: string[] | null
          contingency_pct?: number
          contract_years?: number
          converted_from_lead_id?: string | null
          converted_from_lead_notes?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_type?: string | null
          deal_priority?: string
          deal_template?: string | null
          environment_count?: number
          expected_award_date?: string | null
          expected_user_growth?: string | null
          expected_user_growth_other_detail?: string | null
          external_idp_required?: boolean | null
          geographic_scope?: string | null
          geographic_scope_other_detail?: string | null
          has_integrations?: boolean
          hosting_model?: string | null
          id?: string
          idp_documented?: boolean | null
          include_b2b_portal?: boolean
          include_b2c?: boolean
          integration_count?: number | null
          integration_difficulty?: string | null
          integrations?: Json
          last_reviewed_by?: string | null
          lead_id?: string | null
          margin_justification?: string | null
          margin_percent?: number
          migration_cleanup_required?: boolean | null
          migration_required?: boolean | null
          migration_volume_range?: string | null
          module_tier?: string | null
          name?: string
          needs_attention?: boolean
          opportunity_stage?: string
          owner_id?: string | null
          peak_load_multiplier?: string | null
          peak_load_multiplier_other_detail?: string | null
          portal_form_count_range?: string | null
          pricing_schedule?: string | null
          pricing_schedule_other_detail?: string | null
          quote_validity_date?: string | null
          rep_confidence?: string | null
          repeatable_activation?: string
          requested_by: string
          reviewed_by?: string | null
          sent_at?: string | null
          solution?: string | null
          state?: string
          submitted_at?: string | null
          support_tier?: string | null
          tier?: string
          updated_at?: string
          vertical?: string | null
          vertical_other_detail?: string | null
          worker_idp_required?: boolean | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          b2b_avg_users_per_org?: number | null
          b2b_org_count?: number | null
          b2b_user_count?: number | null
          b2c_mau?: number | null
          billing_preference?: string | null
          billing_preference_other_detail?: string | null
          case_worker_count?: number | null
          case_worker_studio_users?: number | null
          compliance?: string[] | null
          contingency_pct?: number
          contract_years?: number
          converted_from_lead_id?: string | null
          converted_from_lead_notes?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_type?: string | null
          deal_priority?: string
          deal_template?: string | null
          environment_count?: number
          expected_award_date?: string | null
          expected_user_growth?: string | null
          expected_user_growth_other_detail?: string | null
          external_idp_required?: boolean | null
          geographic_scope?: string | null
          geographic_scope_other_detail?: string | null
          has_integrations?: boolean
          hosting_model?: string | null
          id?: string
          idp_documented?: boolean | null
          include_b2b_portal?: boolean
          include_b2c?: boolean
          integration_count?: number | null
          integration_difficulty?: string | null
          integrations?: Json
          last_reviewed_by?: string | null
          lead_id?: string | null
          margin_justification?: string | null
          margin_percent?: number
          migration_cleanup_required?: boolean | null
          migration_required?: boolean | null
          migration_volume_range?: string | null
          module_tier?: string | null
          name?: string
          needs_attention?: boolean
          opportunity_stage?: string
          owner_id?: string | null
          peak_load_multiplier?: string | null
          peak_load_multiplier_other_detail?: string | null
          portal_form_count_range?: string | null
          pricing_schedule?: string | null
          pricing_schedule_other_detail?: string | null
          quote_validity_date?: string | null
          rep_confidence?: string | null
          repeatable_activation?: string
          requested_by?: string
          reviewed_by?: string | null
          sent_at?: string | null
          solution?: string | null
          state?: string
          submitted_at?: string | null
          support_tier?: string | null
          tier?: string
          updated_at?: string
          vertical?: string | null
          vertical_other_detail?: string | null
          worker_idp_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "lead_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_last_reviewed_by_fkey"
            columns: ["last_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_intakes"
            referencedColumns: ["id"]
          },
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
        ]
      }
      rate_cards: {
        Row: {
          bill_rate: number
          cost_rate: number
          created_at: string
          effective_end: string | null
          effective_start: string
          id: string
          location: string
          program_type: string
          role: string
        }
        Insert: {
          bill_rate: number
          cost_rate: number
          created_at?: string
          effective_end?: string | null
          effective_start?: string
          id?: string
          location: string
          program_type: string
          role: string
        }
        Update: {
          bill_rate?: number
          cost_rate?: number
          created_at?: string
          effective_end?: string | null
          effective_start?: string
          id?: string
          location?: string
          program_type?: string
          role?: string
        }
        Relationships: [
        ]
      }
      vertical_labels: {
        Row: {
          description: string
          display_order: number
          friendly_label: string
          vertical_l1: string
        }
        Insert: {
          description: string
          display_order: number
          friendly_label: string
          vertical_l1: string
        }
        Update: {
          description?: string
          display_order?: number
          friendly_label?: string
          vertical_l1?: string
        }
        Relationships: [
        ]
      }
      vertical_solutions: {
        Row: {
          display_label: string
          display_order: number
          id: number
          is_active: boolean
          solution_l2: string
          vertical_l1: string
        }
        Insert: {
          display_label: string
          display_order?: number
          id?: number
          is_active?: boolean
          solution_l2: string
          vertical_l1: string
        }
        Update: {
          display_label?: string
          display_order?: number
          id?: number
          is_active?: boolean
          solution_l2?: string
          vertical_l1?: string
        }
        Relationships: [
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _convert_lead_core: {
        Args: {
          p_lead: Database["public"]["Tables"]["lead_intakes"]["Row"]
          p_quote_owner: string
          p_actor: string
          p_needs_attention: boolean
        }
        Returns: Database["public"]["Tables"]["quotes"]["Row"]
      }
      claim_and_convert_lead: {
        Args: {
          p_lead_id: string
        }
        Returns: Database["public"]["Tables"]["quotes"]["Row"]
      }
      convert_lead_to_quote: {
        Args: {
          p_lead_id: string
        }
        Returns: Database["public"]["Tables"]["quotes"]["Row"]
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      estimator_assign_and_convert: {
        Args: {
          p_lead_id: string
          p_rep_id: string
        }
        Returns: Database["public"]["Tables"]["quotes"]["Row"]
      }
      quote_versions_scoped: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          quote_id: string
          version_number: number
          change_reason: string | null
          changed_by: string | null
          changed_at: string
          snapshot: Json
        }[]
      }
      quotes_scoped: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          owner_id: string | null
          requested_by: string
          reviewed_by: string | null
          approved_by: string | null
          last_reviewed_by: string | null
          name: string
          customer_name: string | null
          customer_type: string | null
          customer_email: string | null
          compliance: string[] | null
          vertical: string | null
          solution: string | null
          vertical_other_detail: string | null
          repeatable_activation: string
          module_tier: string | null
          contract_years: number
          expected_award_date: string | null
          case_worker_count: number | null
          include_b2c: boolean
          b2c_mau: number | null
          include_b2b_portal: boolean
          b2b_user_count: number | null
          hosting_model: string | null
          environment_count: number
          has_integrations: boolean
          integration_count: number | null
          integration_difficulty: string | null
          support_tier: string | null
          rep_confidence: string | null
          tier: string
          state: string
          submitted_at: string | null
          approved_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
          margin_percent: number | null
          margin_justification: string | null
          contingency_pct: number | null
          converted_from_lead_id: string | null
          converted_from_lead_notes: string | null
          migration_required: boolean | null
          migration_volume_range: string | null
          migration_cleanup_required: boolean | null
          external_idp_required: boolean | null
          worker_idp_required: boolean | null
          idp_documented: boolean | null
          portal_form_count_range: string | null
          lead_id: string | null
          needs_attention: boolean
          integrations: Json
          opportunity_stage: string
          deal_priority: string
          deal_template: string | null
          quote_validity_date: string | null
          geographic_scope: string | null
          geographic_scope_other_detail: string | null
          pricing_schedule: string | null
          pricing_schedule_other_detail: string | null
          billing_preference: string | null
          billing_preference_other_detail: string | null
          case_worker_studio_users: number | null
          expected_user_growth: string | null
          expected_user_growth_other_detail: string | null
          peak_load_multiplier: string | null
          peak_load_multiplier_other_detail: string | null
          b2b_org_count: number | null
          b2b_avg_users_per_org: number | null
        }[]
      }
      transition_quote: {
        Args: {
          p_quote_id: string
          p_new_state: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
