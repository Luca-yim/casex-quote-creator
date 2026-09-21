-- Section 2 (Q2.2 Geographic Scope, Q2.3 Pricing Schedule) — FORWARD MIGRATION
-- Target: application database (public.quotes, public.quotes_scoped).
-- Written against the post-Section-1 captured state of public.quotes_scoped():
--   LANGUAGE sql, STABLE, SECURITY DEFINER, OWNER postgres,
--   SET search_path TO 'public', explicit RETURNS TABLE list,
--   EXECUTE granted to postgres and authenticated only, no dependents.
-- Step 0 (0_capture.sql) MUST confirm this state before running.
-- Safe to run exactly once; constraint creation is guarded by existence
-- checks. No database defaults on the new columns. No CASCADE. Does not
-- touch RLS policies, Phase 1A objects, pricing behavior, PDFs, Excel,
-- realtime, workflow states, or the lead-conversion RPCs.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns — all nullable, NO database defaults (Q2.3's naspo/list default
--    is an application/UI default only).
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS geographic_scope               text,
  ADD COLUMN IF NOT EXISTS geographic_scope_other_detail  text,
  ADD COLUMN IF NOT EXISTS pricing_schedule               text,
  ADD COLUMN IF NOT EXISTS pricing_schedule_other_detail  text;

COMMENT ON COLUMN public.quotes.geographic_scope              IS 'v6.4 Q2.2 Geographic Scope (Proposal-only; never mapped from lead_intakes.region)';
COMMENT ON COLUMN public.quotes.geographic_scope_other_detail IS 'v6.4 Q2.2 Other detail (free text)';
COMMENT ON COLUMN public.quotes.pricing_schedule              IS 'v6.4 Q2.3 Pricing Schedule — explicit declared price basis (estimator/admin-writable; metadata only, no pricing effect in this slice)';
COMMENT ON COLUMN public.quotes.pricing_schedule_other_detail IS 'v6.4 Q2.3 Other detail (estimator/admin-only, never shown to sales reps or external users)';

-- ---------------------------------------------------------------------------
-- 2. Check constraints (guarded — ADD CONSTRAINT is not idempotent by itself)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname  = 'quotes_geographic_scope_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_geographic_scope_check
      CHECK (
        geographic_scope IS NULL
        OR geographic_scope IN (
          'single_agency','multi_agency_same_state','multi_state','national','other'
        )
      )
      NOT VALID;
    ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_geographic_scope_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname  = 'quotes_pricing_schedule_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_pricing_schedule_check
      CHECK (
        pricing_schedule IS NULL
        OR pricing_schedule IN ('naspo','list','custom','other')
      )
      NOT VALID;
    ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_pricing_schedule_check;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Server-side write authorization for Q2.3 (narrowly required change).
--    UI hiding alone is insufficient: only estimators and admins may write
--    pricing_schedule / pricing_schedule_other_detail. service_role contexts
--    (auth.uid() IS NULL) pass through. RLS policies themselves are untouched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pricing_schedule_authorization()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO public
AS $function$
BEGIN
  IF NEW.pricing_schedule IS DISTINCT FROM OLD.pricing_schedule
     OR NEW.pricing_schedule_other_detail IS DISTINCT FROM OLD.pricing_schedule_other_detail THEN
    IF auth.uid() IS NULL THEN
      -- Non-authenticated privileged context (service role). Allowed.
      RETURN NEW;
    END IF;
    IF NOT (private.has_role(auth.uid(), 'estimator')
            OR private.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Only estimators and admins may change the pricing schedule'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS quotes_enforce_pricing_schedule_authorization ON public.quotes;

CREATE TRIGGER quotes_enforce_pricing_schedule_authorization
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pricing_schedule_authorization();

-- ---------------------------------------------------------------------------
-- 4. Recreate public.quotes_scoped()
--    The explicit RETURNS TABLE list means the return type changes when
--    columns are appended; CREATE OR REPLACE cannot do that, so DROP + CREATE
--    inside the same transaction is required. The Section 1 function body is
--    reproduced verbatim; the only edits are the four appended RETURNS TABLE
--    columns and the four appended SELECT-list expressions:
--      - geographic_scope / _other_detail: visible to sales_rep/estimator/admin,
--        NULL for external users.
--      - pricing_schedule: estimator/admin always; sales_rep ONLY after
--        approval (approved/sent/accepted/declined) on quotes they own
--        (approved post-approval label exposure); NULL otherwise.
--      - pricing_schedule_other_detail: estimator/admin ONLY — never sales
--        reps, never external users.
--    The existing WHERE clause, ownership filtering, role filtering, margin
--    masking, margin-justification masking and q.contingency_pct behavior are
--    unchanged. LANGUAGE sql / STABLE / SECURITY DEFINER / search_path kept.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.quotes_scoped();

CREATE FUNCTION public.quotes_scoped()
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

-- ---------------------------------------------------------------------------
-- 5. Restore captured ownership and grants (DROP discarded them)
--    Captured grants were postgres + authenticated only. service_role was NOT
--    present in the Section 1 capture and is deliberately not granted.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.quotes_scoped() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO postgres;

COMMIT;

-- Refresh the API schema cache after the transaction commits.
NOTIFY pgrst, 'reload schema';
