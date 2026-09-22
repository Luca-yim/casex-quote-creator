-- =====================================================================
-- Section 3 / Q3.4 (Billing Preference) — FORWARD MIGRATION **DRAFT**
-- =====================================================================
-- STATUS: DRAFT. **NOT APPLIED.** Requires authorized-operator review of the
-- pre-change capture (0_capture.sql) immediately before execution.
--
-- Approved decisions baked into this file (per the approved Q3.4 slice):
--   D1 — YES, a separate billing_preference_other_detail column exists.
--   D2 — stored values are exactly: monthly, annual_upfront,
--        annual_quarterly, other.
--   D3 — "Annual quarterly" is a persisted stored value (annual_quarterly).
--        There is still NO default at any layer: the Proposal UI starts
--        blank and the columns carry no database default.
--   D4 — Sales Representative write access: own quote only, and only while
--        the existing lifecycle considers it editable — the states used by
--        canEditQuote("sales_rep", ...) in src/lib/quote-workflow.ts, i.e.
--        state IN ('draft', 'estimator_adjusted') with owner_id = auth.uid().
--   D5 — External-user write protection is enforced server-side by the new
--        trigger (SQLSTATE 42501), because the live External draft-update
--        RLS path would otherwise expose the columns.
--   D6 — a SEPARATE new trigger (quotes_enforce_billing_preference_authorization);
--        the existing quotes_enforce_pricing_schedule_authorization trigger
--        and function are NOT modified.
--   D7 — database-level Other-detail validation IS required (per the approved
--        slice, both the Zod layer and the database enforce it).
--   D8 — no PDF/export surface: output code is unchanged.
--
-- Live baseline (captured; README.md §1b):
--   public.quotes = 60 columns, 13 rows; no Q3.4 column/constraint existed;
--   quotes_scoped() = 60 outputs ending 57 geographic_scope,
--   58 geographic_scope_other_detail, 59 pricing_schedule,
--   60 pricing_schedule_other_detail; SECURITY DEFINER, STABLE, sql,
--   owner postgres, search_path = public; EXECUTE for authenticated;
--   five non-internal triggers; Section 2 constraints validated.
--
-- Scope ceiling: two nullable columns, two guarded constraints, one new
-- trigger + function, and an APPEND to quotes_scoped() after position 60.
-- Nothing else. Pricing, WBS, rate cards, NASPO, margin, contingency,
-- scoring, approval locks, snapshots, realtime, lead-conversion RPCs,
-- Ballpark behaviour, public lead intake, Section 1, Section 2, Q3.1a and
-- Q3.2 are untouched.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. PREFLIGHT — fail loudly on ANY drift from the captured baseline.
--    This migration deliberately contains NO silent "IF NOT EXISTS"
--    tolerance: every Q3.4 object must be absent and the Section 2
--    baseline must be intact, or the whole transaction aborts before a
--    single object is created. If any assertion fires, STOP, re-run
--    0_capture.sql and re-baseline the package — do not "fix" it by
--    re-adding guards.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n integer;
BEGIN
  -- 0a. Neither Q3.4 column may already exist.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes'
    AND column_name IN ('billing_preference', 'billing_preference_other_detail');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Q3.4 preflight: % billing-preference column(s) already exist on public.quotes — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  -- 0b. public.quotes must still be the captured 60-column table.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes';
  IF n <> 60 THEN
    RAISE EXCEPTION 'Q3.4 preflight: public.quotes has % columns, expected the captured 60 — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  -- 0c. Neither Q3.4 constraint may already exist.
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.quotes'::regclass
    AND conname IN ('quotes_billing_preference_check',
                    'quotes_billing_preference_other_detail_check');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Q3.4 preflight: % billing-preference constraint(s) already exist — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  -- 0d. The Q3.4 trigger and its function may not already exist.
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
      AND tgname = 'quotes_enforce_billing_preference_authorization'
  ) THEN
    RAISE EXCEPTION 'Q3.4 preflight: trigger quotes_enforce_billing_preference_authorization already exists — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  IF to_regprocedure('public.enforce_billing_preference_authorization()') IS NOT NULL THEN
    RAISE EXCEPTION 'Q3.4 preflight: function public.enforce_billing_preference_authorization() already exists — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  -- 0e. The Section 2 pricing trigger and function MUST still be present
  --     and are not touched by this migration.
  IF to_regprocedure('public.enforce_pricing_schedule_authorization()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
         AND tgname = 'quotes_enforce_pricing_schedule_authorization'
     ) THEN
    RAISE EXCEPTION 'Q3.4 preflight: the Section 2 pricing authorization trigger/function is missing — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  -- 0f. quotes_scoped() must exist as the captured 60-output, SECURITY
  --     DEFINER, STABLE, sql function owned by postgres. The replacement
  --     below preserves outputs 1–60 and appends 61–62; if the live
  --     function is not the captured shape, the append is not valid.
  IF to_regprocedure('public.quotes_scoped()') IS NULL THEN
    RAISE EXCEPTION 'Q3.4 preflight: public.quotes_scoped() does not exist — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  SELECT array_length(proargnames, 1) INTO n
  FROM pg_proc WHERE oid = 'public.quotes_scoped()'::regprocedure;
  IF n <> 60 THEN
    RAISE EXCEPTION 'Q3.4 preflight: quotes_scoped() returns % outputs, expected the captured 60 — STOP and re-baseline', n
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.quotes_scoped()'::regprocedure
      AND p.prosecdef
      AND p.provolatile = 's'
      AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql')
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND p.proconfig @> ARRAY['search_path=public']
  ) THEN
    RAISE EXCEPTION 'Q3.4 preflight: quotes_scoped() security properties differ from the capture (expected SECURITY DEFINER, STABLE, sql, owner postgres, search_path=public) — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;

  -- 0g. Positions 57–60 must still be the four Section 2 outputs, since
  --     Q3.4 appends immediately after them.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.quotes_scoped()'::regprocedure
      AND p.proargnames[57:60] = ARRAY['geographic_scope',
                                       'geographic_scope_other_detail',
                                       'pricing_schedule',
                                       'pricing_schedule_other_detail']
  ) THEN
    RAISE EXCEPTION 'Q3.4 preflight: quotes_scoped() outputs 57-60 are not the captured Section 2 fields — STOP and re-baseline'
      USING ERRCODE = '55000';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Columns — nullable text, NO database default, NO backfill.
--    All 13 pre-existing rows therefore remain NULL for both fields and
--    stay valid. Verified afterwards by VERIFY.sql A2.
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS billing_preference              text,
  ADD COLUMN IF NOT EXISTS billing_preference_other_detail text;

COMMENT ON COLUMN public.quotes.billing_preference IS
  'v6.4 Q3.4 Billing Preference (Proposal-only; optional; no pricing effect)';
COMMENT ON COLUMN public.quotes.billing_preference_other_detail IS
  'v6.4 Q3.4 Other detail (free text); required when billing_preference = other';

-- ---------------------------------------------------------------------
-- 2. Constraints — guarded (NOT VALID then VALIDATE) so the table is not
--    long-locked and the 13 pre-existing NULL rows cannot fail.
-- ---------------------------------------------------------------------
-- No IF NOT EXISTS guard: §0c asserted this constraint is absent, so a name
-- collision is drift and must abort the transaction.
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_billing_preference_check
  CHECK (billing_preference IS NULL
         OR billing_preference IN
            ('monthly', 'annual_upfront', 'annual_quarterly', 'other'))
  NOT VALID;

ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_billing_preference_check;

-- Complete relationship between the two Q3.4 columns. The CASE form covers
-- all four required rules in one expression:
--   preference NULL          + detail NULL     -> VALID  (all 13 existing rows)
--   preference NULL          + detail NOT NULL -> REJECTED (ELSE branch)
--   preference <> 'other'    + detail NULL     -> VALID
--   preference <> 'other'    + detail NOT NULL -> REJECTED (ELSE branch)
--   preference  = 'other'    + nonblank detail -> VALID
--   preference  = 'other'    + NULL or blank   -> REJECTED (THEN branch)
-- NULL preference falls to ELSE because `NULL = 'other'` is not true, so an
-- orphaned detail can never be stored.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_billing_preference_other_detail_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_billing_preference_other_detail_check
      CHECK (
        CASE
          WHEN billing_preference = 'other'
            THEN billing_preference_other_detail IS NOT NULL
                 AND btrim(billing_preference_other_detail) <> ''
          ELSE billing_preference_other_detail IS NULL
        END
      )
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_billing_preference_other_detail_check;

-- ---------------------------------------------------------------------
-- 3. Write authorization — separate, narrowly scoped trigger. Inspects ONLY
--    the two Q3.4 columns; every unrelated field and all five existing
--    triggers are unaffected. Trusted system context (auth.uid() IS NULL)
--    passes, matching the Section 2 trigger convention. Ballpark and
--    lead-converted quotes insert NULL/NULL, which is not a protected write.
--
--    SALES REPRESENTATIVE RULE (authoritative): own the quote AND the quote
--    is editable under the existing lifecycle. Ownership is owner_id; the
--    editable states are the ones canEditIntake/canEditQuote already use for
--    sales_rep in src/lib/quote-workflow.ts, i.e. draft and
--    estimator_adjusted. A rep who merely REQUESTED a draft they do not own
--    (requested_by = auth.uid(), owner_id <> auth.uid()) is DENIED here and
--    reads NULL from the masking in §4. This is intentional and is NOT a
--    change to the row-scope predicate below, which is preserved verbatim:
--    draft rows remain visible on requested_by, and no draft visibility is
--    broadened by this migration.
-- ---------------------------------------------------------------------
-- Plain CREATE (not CREATE OR REPLACE): §0d asserted this function does not
-- exist, so an existing definition is drift and must abort.
CREATE FUNCTION public.enforce_billing_preference_authorization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  protected_write boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    protected_write := NEW.billing_preference IS NOT NULL
                       OR NEW.billing_preference_other_detail IS NOT NULL;
  ELSE
    protected_write := NEW.billing_preference IS DISTINCT FROM OLD.billing_preference
                       OR NEW.billing_preference_other_detail IS DISTINCT FROM OLD.billing_preference_other_detail;
  END IF;

  IF protected_write THEN
    -- Trusted system context: service/system operations run without a user.
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    IF public.current_user_role() IN ('estimator', 'admin') THEN
      RETURN NEW;
    END IF;

    -- Sales reps: own quote only, and only while the existing lifecycle
    -- considers it editable (canEditQuote for sales_rep: draft or
    -- estimator_adjusted).
    IF public.current_user_role() = 'sales_rep'
       AND NEW.owner_id = auth.uid()
       AND NEW.state IN ('draft', 'estimator_adjusted') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Only estimators, admins, or the owning sales rep on an editable quote may set the billing preference'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- No DROP TRIGGER IF EXISTS: §0d asserted the trigger is absent, so a name
-- collision here is drift and must abort the transaction.

CREATE TRIGGER quotes_enforce_billing_preference_authorization
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_billing_preference_authorization();

-- ---------------------------------------------------------------------
-- 4. quotes_scoped() — 62 outputs; positions 1–60 preserved exactly;
--    Q3.4 outputs appended at 61–62.
--
--    OPERATOR CHECK before running: re-run 0_capture.sql and confirm the
--    live definition still matches the preserved positions 1–60 below
--    (the live capture verified this baseline; if it has drifted, STOP and
--    re-baseline rather than overwrite). The body below preserves the
--    captured masking expressions, row-scope predicates, LANGUAGE sql,
--    STABLE, SECURITY DEFINER, SET search_path = 'public' and the 60
--    existing outputs verbatim, appending only:
--      61 billing_preference
--      62 billing_preference_other_detail
-- ---------------------------------------------------------------------
-- No IF EXISTS: §0f already asserted the captured 60-output function is
-- present, so a missing function here is drift and must abort. The DROP is
-- required because CREATE OR REPLACE cannot change a function's RETURNS
-- TABLE signature; the CREATE OR REPLACE form below is retained so the
-- statement matches the captured pg_get_functiondef() text.
DROP FUNCTION public.quotes_scoped();

CREATE OR REPLACE FUNCTION public.quotes_scoped()
 RETURNS TABLE(id uuid, owner_id uuid, requested_by uuid, reviewed_by uuid, approved_by uuid, last_reviewed_by uuid, name text, customer_name text, customer_type text, customer_email text, compliance text[], vertical text, solution text, vertical_other_detail text, repeatable_activation text, module_tier text, contract_years integer, expected_award_date date, case_worker_count integer, include_b2c boolean, b2c_mau integer, include_b2b_portal boolean, b2b_user_count integer, hosting_model text, environment_count integer, has_integrations boolean, integration_count integer, integration_difficulty text, support_tier text, rep_confidence text, tier text, state text, submitted_at timestamp with time zone, approved_at timestamp with time zone, sent_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, margin_percent integer, margin_justification text, contingency_pct numeric, converted_from_lead_id uuid, converted_from_lead_notes text, migration_required boolean, migration_volume_range text, migration_cleanup_required boolean, external_idp_required boolean, worker_idp_required boolean, idp_documented boolean, portal_form_count_range text, lead_id uuid, needs_attention boolean, integrations jsonb, opportunity_stage text, deal_priority text, deal_template text, quote_validity_date date, geographic_scope text, geographic_scope_other_detail text, pricing_schedule text, pricing_schedule_other_detail text, billing_preference text, billing_preference_other_detail text)
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
    end,
    -- Q3.4: estimator/admin always; sales reps only on their OWN quote while
    -- the existing lifecycle considers it editable (draft / estimator_adjusted);
    -- external users always NULL. Mirrors the new authorization trigger.
    --
    -- Row scope vs. field scope, stated explicitly (no predicate change):
    --   The WHERE clause below still admits drafts on requested_by. A rep
    --   therefore reads a non-NULL Q3.4 value only when BOTH hold: the row
    --   predicate exposes the row, AND owner_id = auth.uid() with the state
    --   editable. A rep who requested but does not own a draft sees the row
    --   with NULL in both Q3.4 outputs, and the trigger rejects their write
    --   with 42501. Nothing here widens draft visibility.
    case
      when public.current_user_role() in ('estimator','admin') then q.billing_preference
      when public.current_user_role() = 'sales_rep' and auth.uid() = q.owner_id
        and q.state in ('draft','estimator_adjusted')
        then q.billing_preference
      else null
    end,
    case
      when public.current_user_role() in ('estimator','admin') then q.billing_preference_other_detail
      when public.current_user_role() = 'sales_rep' and auth.uid() = q.owner_id
        and q.state in ('draft','estimator_adjusted')
        then q.billing_preference_other_detail
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

-- ---------------------------------------------------------------------
-- 5. Owner, security settings and grants — restored exactly as captured.
--    CREATE OR REPLACE preserves them; the DROP above discards them, so
--    they are re-asserted here. Least privilege: no anon or PUBLIC grant.
-- ---------------------------------------------------------------------
ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.quotes_scoped() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotes_scoped() TO postgres;

COMMIT;

-- Refresh the API schema cache after the transaction commits.
NOTIFY pgrst, 'reload schema';
