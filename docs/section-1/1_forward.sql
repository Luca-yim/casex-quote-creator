-- Section 1 (Quote Metadata) — FORWARD MIGRATION
-- Target: application database (public.quotes, public.quotes_scoped)
-- Captured state this file is written against:
--   public.quotes_scoped() : LANGUAGE sql, STABLE, SECURITY DEFINER,
--                            OWNER postgres, SET search_path TO 'public',
--                            explicit RETURNS TABLE(...) column list,
--                            EXECUTE granted to postgres and authenticated only,
--                            no dependent routines or views.
-- Because the captured function uses an explicit RETURNS TABLE list, the return
-- type changes when columns are appended; CREATE OR REPLACE cannot do that, so a
-- DROP + CREATE inside the same transaction is required (case 2b).
-- Safe to run exactly once. Constraint creation is guarded by existence checks.
-- Does NOT touch RLS policies, Phase 1A objects, pricing behaviour, contingency
-- masking, Proposal workflow, PDFs, Excel, realtime, or application code.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS opportunity_stage  text NOT NULL DEFAULT 'discovery',
  ADD COLUMN IF NOT EXISTS deal_priority      text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS deal_template      text,
  ADD COLUMN IF NOT EXISTS quote_validity_date date;

COMMENT ON COLUMN public.quotes.opportunity_stage   IS 'v6.4 Q1.4 Opportunity Stage (internal-only metadata; no pricing effect)';
COMMENT ON COLUMN public.quotes.deal_priority       IS 'v6.4 Q1.7 Deal Priority (internal-only metadata; no pricing effect)';
COMMENT ON COLUMN public.quotes.deal_template       IS 'v6.4 Q1.8 Deal Template Used (nullable, internal-only metadata)';
COMMENT ON COLUMN public.quotes.quote_validity_date IS 'v6.4 Q1.9 Quote Validity Date (nullable; blank means no validity statement in PDFs)';

-- ---------------------------------------------------------------------------
-- 2. Check constraints (guarded — ADD CONSTRAINT is not idempotent by itself)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname  = 'quotes_opportunity_stage_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_opportunity_stage_check
      CHECK (opportunity_stage IN ('discovery','qualified','proposal','negotiation','closed','other'))
      NOT VALID;
    ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_opportunity_stage_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname  = 'quotes_deal_priority_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_deal_priority_check
      CHECK (deal_priority IN ('standard','strategic','rush','other'))
      NOT VALID;
    ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_deal_priority_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname  = 'quotes_deal_template_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_deal_template_check
      CHECK (
        deal_template IS NULL
        OR deal_template IN (
          'state_workers_comp',
          'state_health_benefits',
          'county_justice_modernization',
          'federal_small_deployment',
          'blank',
          'other'
        )
      )
      NOT VALID;
    ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_deal_template_check;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Recreate public.quotes_scoped()
--    Captured body reproduced verbatim; the only edits are the four appended
--    RETURNS TABLE columns and the four appended SELECT-list expressions.
--    WHERE clause, ownership/sales_rep/external/estimator/admin filtering,
--    margin masking, margin-justification masking and q.contingency_pct are
--    unchanged. LANGUAGE sql / STABLE / SECURITY DEFINER / search_path kept.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.quotes_scoped();

CREATE FUNCTION public.quotes_scoped()
 RETURNS TABLE(id uuid, owner_id uuid, requested_by uuid, reviewed_by uuid, approved_by uuid, last_reviewed_by uuid, name text, customer_name text, customer_type text, customer_email text, compliance text[], vertical text, solution text, vertical_other_detail text, repeatable_activation text, module_tier text, contract_years integer, expected_award_date date, case_worker_count integer, include_b2c boolean, b2c_mau integer, include_b2b_portal boolean, b2b_user_count integer, hosting_model text, environment_count integer, has_integrations boolean, integration_count integer, integration_difficulty text, support_tier text, rep_confidence text, tier text, state text, submitted_at timestamp with time zone, approved_at timestamp with time zone, sent_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, margin_percent integer, margin_justification text, contingency_pct numeric, converted_from_lead_id uuid, converted_from_lead_notes text, migration_required boolean, migration_volume_range text, migration_cleanup_required boolean, external_idp_required boolean, worker_idp_required boolean, idp_documented boolean, portal_form_count_range text, lead_id uuid, needs_attention boolean, integrations jsonb, opportunity_stage text, deal_priority text, deal_template text, quote_validity_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    q.id, q.owner_id, q.requested_by, q.reviewed_by, q.approved_by, q.last_reviewed_by,
    q.name, q.customer_name, q.customer_type, q.customer_email,
    q.compliance, q.vertical, q.solution, q.vertical_other_detail,
    q.repeatable_activation, q.module_tier, q.contract_years,
    q.expected_award_date, q.case_worker_count,
    q.include_b2c, q.b2c_mau, q.include_b2b_portal, q.b2b_user_count,
    q.hosting_model, q.environment_count,
    q.has_integrations, q.integration_count, q.integration_difficulty,
    q.support_tier, q.rep_confidence,
    q.tier, q.state,
    q.submitted_at, q.approved_at, q.sent_at, q.created_at, q.updated_at,
    case
      when public.current_user_role() in ('estimator','admin') then q.margin_percent
      when auth.uid() = q.owner_id and q.state in ('approved','sent_to_customer','accepted','declined')
        then q.margin_percent
      else null
    end,
    case
      when public.current_user_role() in ('estimator','admin') then q.margin_justification
      else null
    end,
    q.contingency_pct,
    q.converted_from_lead_id, q.converted_from_lead_notes,
    q.migration_required, q.migration_volume_range, q.migration_cleanup_required,
    q.external_idp_required, q.worker_idp_required, q.idp_documented,
    q.portal_form_count_range,
    q.lead_id,
    q.needs_attention,
    q.integrations,
    q.opportunity_stage,
    q.deal_priority,
    q.deal_template,
    q.quote_validity_date
  from public.quotes q
  where
    (q.state = 'draft' and q.requested_by = auth.uid())
    or (public.current_user_role() = 'sales_rep' and q.state <> 'draft' and q.owner_id = auth.uid())
    or (public.current_user_role() = 'external' and q.state <> 'draft' and q.requested_by = auth.uid())
    or (public.current_user_role() = 'admin' and q.state <> 'draft')
    or (public.current_user_role() = 'estimator' and q.state <> 'draft'
        and (q.state <> 'under_review' or q.reviewed_by = auth.uid()))
$function$;

-- ---------------------------------------------------------------------------
-- 4. Restore captured ownership and grants (DROP discarded them)
--    Captured grants were postgres + authenticated only. service_role was NOT
--    present in the capture and is deliberately not granted.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.quotes_scoped() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO postgres;

COMMIT;

-- Refresh the API schema cache after the transaction commits.
NOTIFY pgrst, 'reload schema';
