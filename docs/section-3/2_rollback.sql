-- =====================================================================
-- Section 3 / Q3.4 (Billing Preference) — ROLLBACK **DRAFT**
-- =====================================================================
-- STATUS: DRAFT. **NOT EXECUTABLE UNTIL REVIEWED.** NOT APPLIED.
--
-- WARNING — PRESERVE THE PRE-CHANGE CAPTURE FIRST.
--   Run 0_capture.sql and keep its output before executing this rollback.
--   The quotes_scoped() definition restored in §4 below is the captured
--   pre-change (60-column) baseline — identical to the definition verified
--   by the live capture and reproduced in docs/section-3/1_forward.sql §4
--   with the two Q3.4 outputs removed. If the live database has drifted
--   since that capture, STOP and re-baseline instead of running this file.
--
-- This rollback removes ONLY Q3.4 objects. It must not touch Section 1,
-- Section 2, Q3.1a, Q3.2, the Section 2 authorization trigger
-- (quotes_enforce_pricing_schedule_authorization), the other four live
-- triggers, the quotes RLS policies, pricing objects, WBS, NASPO, margin,
-- contingency, scoring, lead-conversion RPCs, or any data other than the
-- Q3.4 column values noted in §3.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. PREFLIGHT — fail loudly on ANY drift from the expected Q3.4 state.
--    Like the forward migration, this rollback contains NO silent
--    "IF EXISTS" tolerance: every Q3.4 object must be present in the
--    expected shape, or the transaction aborts before anything is dropped.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n integer;
BEGIN
  -- 0a. Both Q3.4 columns must exist.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes'
    AND column_name IN ('billing_preference', 'billing_preference_other_detail');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: % of the 2 billing-preference columns exist — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  -- 0b. public.quotes must be the post-forward 62-column table.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes';
  IF n <> 62 THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: public.quotes has % columns, expected 62 — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  -- 0c. Both Q3.4 constraints must exist.
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.quotes'::regclass
    AND conname IN ('quotes_billing_preference_check',
                    'quotes_billing_preference_other_detail_check');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: % of the 2 billing-preference constraints exist — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  -- 0d. The Q3.4 trigger and function must exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
      AND tgname = 'quotes_enforce_billing_preference_authorization'
  ) OR to_regprocedure('public.enforce_billing_preference_authorization()') IS NULL THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: the billing-preference trigger/function is missing — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  -- 0e. The Section 2 pricing trigger must still be present and is not
  --     touched by this rollback.
  IF to_regprocedure('public.enforce_pricing_schedule_authorization()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
         AND tgname = 'quotes_enforce_pricing_schedule_authorization'
     ) THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: the Section 2 pricing authorization trigger/function is missing — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  -- 0f. quotes_scoped() must be the post-forward 62-output function with
  --     the Q3.4 fields at positions 61–62.
  SELECT array_length(proargnames, 1) INTO n
  FROM pg_proc WHERE oid = 'public.quotes_scoped()'::regprocedure;
  IF n <> 62 THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: quotes_scoped() returns % outputs, expected 62 — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.quotes_scoped()'::regprocedure
      AND p.proargnames[61:62] = ARRAY['billing_preference',
                                       'billing_preference_other_detail']
  ) THEN
    RAISE EXCEPTION 'Q3.4 rollback preflight: quotes_scoped() outputs 61-62 are not the Q3.4 fields — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Drop the Q3.4 trigger, then its function.
-- ---------------------------------------------------------------------
DROP TRIGGER quotes_enforce_billing_preference_authorization
  ON public.quotes;
DROP FUNCTION public.enforce_billing_preference_authorization();

-- ---------------------------------------------------------------------
-- 2. Drop Q3.4 constraints (before the columns; no CASCADE anywhere).
-- ---------------------------------------------------------------------
-- No IF EXISTS: the preflight in §0 asserted both constraints exist, so a
-- missing constraint is drift and must abort the transaction.
ALTER TABLE public.quotes
  DROP CONSTRAINT quotes_billing_preference_other_detail_check;
ALTER TABLE public.quotes
  DROP CONSTRAINT quotes_billing_preference_check;

-- ---------------------------------------------------------------------
-- 3. Drop Q3.4 columns, returning public.quotes to its captured 60-column
--    shape. DESTRUCTIVE: any billing preference values entered between the
--    forward migration and this rollback are permanently lost. Export them
--    first and review the result before proceeding:
--      SELECT id, billing_preference, billing_preference_other_detail
--      FROM public.quotes
--      WHERE billing_preference IS NOT NULL
--         OR billing_preference_other_detail IS NOT NULL;
-- ---------------------------------------------------------------------
-- No IF EXISTS: the preflight in §0 asserted both columns exist, so a
-- missing column is drift and must abort the transaction.
ALTER TABLE public.quotes
  DROP COLUMN billing_preference_other_detail,
  DROP COLUMN billing_preference;

-- ---------------------------------------------------------------------
-- 4. Restore quotes_scoped() to the captured pre-change 60-column state:
--    exactly 60 output columns in their original order, ending
--      57 geographic_scope
--      58 geographic_scope_other_detail
--      59 pricing_schedule
--      60 pricing_schedule_other_detail
--    with all captured masking expressions, row-scope predicates, LANGUAGE
--    sql, STABLE, SECURITY DEFINER, SET search_path = 'public' unchanged.
--    This is the pre-change capture baseline (docs/section-3 0_capture.sql
--    query 4), NOT the 62-column Q3.4 version.
-- ---------------------------------------------------------------------
-- No IF EXISTS: the preflight in §0 asserted the 62-output Q3.4 function is
-- present, so a missing function here is drift and must abort. The DROP is
-- required because CREATE OR REPLACE cannot change a function's RETURNS
-- TABLE signature; the CREATE OR REPLACE form below matches the captured
-- pg_get_functiondef() statement form.
DROP FUNCTION public.quotes_scoped();

CREATE OR REPLACE FUNCTION public.quotes_scoped()
 RETURNS TABLE(id uuid, owner_id uuid, requested_by uuid, reviewed_by uuid, approved_by uuid, last_reviewed_by uuid, name text, customer_name text, customer_type text, customer_email text, compliance text[], vertical text, solution text, vertical_other_detail text, repeatable_activation text, module_tier text, contract_years integer, expected_award_date date, case_worker_count integer, include_b2c boolean, b2c_mau integer, include_b2b_portal boolean, b2b_user_count integer, hosting_model text, environment_count integer, has_integrations boolean, integration_count integer, integration_difficulty text, support_tier text, rep_confidence text, tier text, state text, submitted_at timestamp with time zone, approved_at timestamp with time zone, sent_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, margin_percent integer, margin_justification text, contingency_pct numeric, converted_from_lead_id uuid, converted_from_lead_notes text, migration_required boolean, migration_volume_range text, migration_cleanup_required boolean, external_idp_required boolean, worker_idp_required boolean, idp_documented boolean, portal_form_count_range text, lead_id uuid, needs_attention boolean, integrations jsonb, opportunity_stage text, deal_priority text, deal_template text, quote_validity_date date, geographic_scope text, geographic_scope_other_detail text, pricing_schedule text, pricing_schedule_other_detail text)
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
    q.quote_validity_date,
    -- Q2.2: hidden from external users; visible to internal roles and reps.
    case
      when public.current_user_role() in ('sales_rep','estimator','admin') then q.geographic_scope
      else null
    end,
    case
      when public.current_user_role() in ('sales_rep','estimator','admin') then q.geographic_scope_other_detail
      else null
    end,
    -- Q2.3: estimator/admin always; sales reps only the approved
    -- post-approval label on quotes they own; never external users.
    case
      when public.current_user_role() in ('estimator','admin') then q.pricing_schedule
      when public.current_user_role() = 'sales_rep' and auth.uid() = q.owner_id
        and q.state in ('approved','sent_to_customer','accepted','declined')
        then q.pricing_schedule
      else null
    end,
    -- Q2.3 Other detail: estimator/admin ONLY.
    case
      when public.current_user_role() in ('estimator','admin') then q.pricing_schedule_other_detail
      else null
    end
  from public.quotes q
  where
    (q.state = 'draft' and q.requested_by = auth.uid())
    or (public.current_user_role() = 'sales_rep' and q.state <> 'draft' and q.owner_id = auth.uid())
    or (public.current_user_role() = 'external' and q.state <> 'draft' and q.requested_by = auth.uid())
    or (public.current_user_role() = 'admin' and q.state <> 'draft')
    or (public.current_user_role() = 'estimator' and q.state <> 'draft'
        and (q.state <> 'under_review' or q.reviewed_by = auth.uid()))
$function$;

-- Restore the captured owner and grant set (the DROP discarded them).
-- Captured baseline: EXECUTE for postgres + authenticated only. Do not add a
-- service_role grant. Do not grant EXECUTE to anon or PUBLIC.
ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.quotes_scoped() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- After rollback: re-run 0_capture.sql and diff against the pre-change
-- capture. Expect 60 columns, 13 rows (unless rows changed through normal
-- application use), the captured 60-output function definition and
-- properties, the captured grants, the captured RLS policies, and all five
-- original non-internal triggers (enforce_quote_state,
-- notify_quote_reassignment, notify_quote_state_change,
-- quotes_enforce_pricing_schedule_authorization, quotes_updated_at).
