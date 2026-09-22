-- Section 3 / Q3.4 (Billing Preference) — VERIFICATION **DRAFT**
-- Run against the application database AFTER 1_forward.sql (which is itself
-- a draft pending authorized-operator review; re-run 0_capture.sql first to
-- confirm no drift).
--
-- Baseline from the COMPLETED live capture (0_capture.sql; README.md §1b):
--   public.quotes = 60 columns, 18 rows.
--   quotes_scoped() = exactly 60 output columns; positions 57–60 are
--     geographic_scope, geographic_scope_other_detail, pricing_schedule,
--     pricing_schedule_other_detail.
--   quotes_scoped(): SECURITY DEFINER, STABLE, sql, owner postgres,
--     search_path = public; EXECUTE for authenticated.
--   Five non-internal triggers on public.quotes.
--
-- Part A is static/catalog only. Part B REQUIRES REAL AUTHENTICATED SESSIONS
-- and cannot be satisfied statically or by running as postgres.

-- =====================================================================
-- PART A — STATIC / CATALOG CHECKS (no session role required)
--
-- DRIFT POLICY: neither migration file contains silent "IF NOT EXISTS"/
-- "IF EXISTS" tolerance for Q3.4 objects any more. Both carry a §0
-- preflight DO block that RAISES 55000 and aborts the transaction if any
-- expected Q3.4 object already exists (forward) or is missing (rollback),
-- or if the captured baseline (60 columns, 60-output quotes_scoped with
-- Section 2 fields at 57–60, Section 2 pricing trigger present) has
-- drifted. Both quotes_scoped() definitions are written as
-- CREATE OR REPLACE FUNCTION to match the captured pg_get_functiondef()
-- statement form; the drop/recreate around them still handles the
-- signature change.
-- =====================================================================

SELECT '=== A0. Column count moved from 60 to 62 ===' AS verification_step;
SELECT count(*) AS quotes_column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes';
-- EXPECT: 62.

SELECT '=== A1. Q3.4 columns: type, nullability, NO default ===' AS verification_step;
SELECT column_name, data_type, is_nullable, column_default, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('billing_preference','billing_preference_other_detail')
ORDER BY ordinal_position;
-- EXPECT: two rows, text / YES / null. Expected ordinal positions 61 and 62.

SELECT '=== A2. All 18 captured rows remain NULL; row count unchanged ===' AS verification_step;
SELECT count(*) AS total,
       count(*) FILTER (WHERE billing_preference IS NULL)                  AS pref_null,
       count(*) FILTER (WHERE billing_preference_other_detail IS NULL)     AS detail_null,
       count(*) FILTER (WHERE billing_preference IS NOT NULL)              AS pref_populated,
       count(*) FILTER (WHERE billing_preference_other_detail IS NOT NULL) AS detail_populated
FROM public.quotes;
-- EXPECT: total = 18 (fresh captured baseline; higher only if rows were
--         created through normal application use since capture), and
--         pref_null = detail_null = total, pref_populated = detail_populated = 0.
--         Nullable columns with no default and no backfill must leave every
--         pre-existing row NULL.

SELECT '=== A2a. Hard assertion — 18 pre-existing rows, no backfill, no default ===' AS verification_step;
DO $$
DECLARE
  n_rows integer;
  n_pref integer;
  n_detail integer;
  n_default integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE billing_preference IS NOT NULL),
         count(*) FILTER (WHERE billing_preference_other_detail IS NOT NULL)
    INTO n_rows, n_pref, n_detail
  FROM public.quotes;

  IF n_rows < 18 THEN
    RAISE EXCEPTION 'A2a: public.quotes has % rows, expected at least the 18 captured rows', n_rows
      USING ERRCODE = '55000';
  END IF;
  IF n_pref <> 0 OR n_detail <> 0 THEN
    RAISE EXCEPTION 'A2a: % non-NULL billing_preference and % non-NULL detail values found — a backfill occurred', n_pref, n_detail
      USING ERRCODE = '55000';
  END IF;

  SELECT count(*) INTO n_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes'
    AND column_name IN ('billing_preference','billing_preference_other_detail')
    AND column_default IS NOT NULL;
  IF n_default <> 0 THEN
    RAISE EXCEPTION 'A2a: % Q3.4 column(s) carry a DEFAULT — none is authorized', n_default
      USING ERRCODE = '55000';
  END IF;
END $$;
-- EXPECT: no output. Any RAISE means the migration deviated from the approved
-- no-default / no-backfill rule. (n_rows > 18 is tolerated only as normal
-- application activity; the NULL assertions apply to every row regardless.)

SELECT '=== A2b. Section 2 field baseline unchanged (NULL / populated counts) ===' AS verification_step;
SELECT count(*)                                                              AS total_rows,
       count(*) FILTER (WHERE geographic_scope IS NULL)                      AS geographic_scope_null,
       count(*) FILTER (WHERE geographic_scope IS NOT NULL)                  AS geographic_scope_populated,
       count(*) FILTER (WHERE geographic_scope_other_detail IS NULL)         AS geographic_scope_other_detail_null,
       count(*) FILTER (WHERE geographic_scope_other_detail IS NOT NULL)     AS geographic_scope_other_detail_populated,
       count(*) FILTER (WHERE pricing_schedule IS NULL)                      AS pricing_schedule_null,
       count(*) FILTER (WHERE pricing_schedule IS NOT NULL)                  AS pricing_schedule_populated,
       count(*) FILTER (WHERE pricing_schedule_other_detail IS NULL)         AS pricing_schedule_other_detail_null,
       count(*) FILTER (WHERE pricing_schedule_other_detail IS NOT NULL)     AS pricing_schedule_other_detail_populated
FROM public.quotes;
-- EXPECT: identical to the counts recorded by 0_capture.sql query 13 (subject
--         only to normal application activity). Q3.4 adds no read, write, or
--         default affecting Section 2 values. Also confirm via A3/A9 that the
--         Section 2 constraints and the pricing authorization trigger/function
--         are unchanged.

SELECT '=== A3. Both constraints present and VALIDATED ===' AS verification_step;
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_billing_preference_check',
                  'quotes_billing_preference_other_detail_check');
-- EXPECT: two rows, convalidated = true. The option check permits NULL or
--         one of monthly / annual_upfront / annual_quarterly / other. The
--         Other-detail check is the CASE form enforcing the COMPLETE
--         relationship: when billing_preference = 'other' the detail must be
--         present and nonblank; in every other case (including a NULL
--         preference) the detail must be NULL.

SELECT '=== A4. Constraint truth table — all six cases ===' AS verification_step;
-- Operator note: run inside an explicit transaction that is ROLLED BACK. It
-- must not leave any of the 18 rows modified. Use <id> = any existing row.
--
-- 1 VALID    pref NULL,               detail NULL
--   UPDATE public.quotes SET billing_preference = NULL,
--          billing_preference_other_detail = NULL WHERE id = <id>;
--   -> succeeds (this is the state of all 18 captured rows)
--
-- 2 REJECTED pref NULL,               detail NOT NULL   <-- orphaned detail
--   UPDATE public.quotes SET billing_preference = NULL,
--          billing_preference_other_detail = 'stray' WHERE id = <id>;
--   -> check_violation (quotes_billing_preference_other_detail_check)
--
-- 3 VALID    pref 'annual_quarterly', detail NULL
--   UPDATE public.quotes SET billing_preference = 'annual_quarterly',
--          billing_preference_other_detail = NULL WHERE id = <id>;
--   -> succeeds
--
-- 4 REJECTED pref 'monthly',          detail NOT NULL   <-- detail on a
--   non-Other preference
--   UPDATE public.quotes SET billing_preference = 'monthly',
--          billing_preference_other_detail = 'stray' WHERE id = <id>;
--   -> check_violation (quotes_billing_preference_other_detail_check)
--
-- 5 REJECTED pref 'other', detail NULL, and pref 'other', detail '   '
--   UPDATE public.quotes SET billing_preference = 'other',
--          billing_preference_other_detail = NULL WHERE id = <id>;
--   UPDATE public.quotes SET billing_preference = 'other',
--          billing_preference_other_detail = '   ' WHERE id = <id>;
--   -> check_violation both times (NULL and whitespace-only via btrim)
--
-- 6 VALID    pref 'other',            nonblank detail
--   UPDATE public.quotes SET billing_preference = 'other',
--          billing_preference_other_detail = 'Milestone invoicing'
--     WHERE id = <id>; -> succeeds
--
-- Invalid option value, independent of the detail rule:
--   UPDATE public.quotes SET billing_preference = 'weekly' WHERE id = <id>;
--   -> check_violation (quotes_billing_preference_check)
--
-- Then ROLLBACK and re-run A2 to confirm all rows are NULL again.
-- Note: these run as an authorized role (estimator/admin or trusted
-- context); otherwise the Q3.4 trigger raises 42501 before the constraint
-- is ever evaluated.

SELECT '=== A5. quotes_scoped() output columns — count, order, append position ===' AS verification_step;
SELECT ordinality AS output_position, name AS output_column
FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY AS t(name, ordinality)
WHERE p.oid = 'public.quotes_scoped()'::regprocedure
ORDER BY ordinality;
-- EXPECT: exactly 62 outputs. Positions 1–60 byte-identical to the captured
--         baseline, ending 57 geographic_scope, 58
--         geographic_scope_other_detail, 59 pricing_schedule,
--         60 pricing_schedule_other_detail; 61 billing_preference;
--         62 billing_preference_other_detail. No reordering, duplicates or
--         removals. No SELECT * anywhere in the definition.

SELECT '=== A5b. Output column count ===' AS verification_step;
SELECT array_length(proargnames, 1) AS output_column_count
FROM pg_proc WHERE oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: 62.

SELECT '=== A6. quotes_scoped() security properties unchanged ===' AS verification_step;
SELECT p.prosecdef AS is_security_definer,
       p.provolatile AS volatility,
       p.prolang::regproc AS language,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p
WHERE p.oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: true / s (STABLE) / sql / postgres / search_path = public.

SELECT '=== A7. quotes_scoped() grants remain least privilege ===' AS verification_step;
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'quotes_scoped';
-- EXPECT: EXECUTE for postgres and authenticated ONLY. No anon, no PUBLIC,
--         no service_role.

SELECT '=== A8. Q3.4 trigger and function exist with correct scope ===' AS verification_step;
SELECT tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
  AND t.tgname = 'quotes_enforce_billing_preference_authorization';
-- EXPECT: one row; BEFORE INSERT OR UPDATE; FOR EACH ROW; function
--         public.enforce_billing_preference_authorization().
SELECT pg_get_functiondef('public.enforce_billing_preference_authorization()'::regprocedure);
-- EXPECT: plpgsql, search_path = public, inspects ONLY billing_preference
--         and billing_preference_other_detail, allows auth.uid() IS NULL,
--         estimator/admin always, sales_rep only with NEW.owner_id =
--         auth.uid() AND NEW.state IN ('draft','estimator_adjusted'),
--         raises SQLSTATE 42501 otherwise.

SELECT '=== A9. The existing pricing authorization trigger is UNCHANGED ===' AS verification_step;
SELECT md5(pg_get_functiondef('public.enforce_pricing_schedule_authorization()'::regprocedure)) AS section2_fn_md5;
-- EXPECT: identical hash to the pre-change capture. Compare with the value
--         recorded by 0_capture.sql before the migration.
SELECT tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
  AND t.tgname = 'quotes_enforce_pricing_schedule_authorization';
-- EXPECT: BEFORE INSERT OR UPDATE, unchanged from the capture.

SELECT '=== A10. All five original non-internal triggers remain present ===' AS verification_step;
SELECT t.tgname
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;
-- EXPECT: enforce_quote_state, notify_quote_reassignment,
--         notify_quote_state_change,
--         quotes_enforce_billing_preference_authorization (the new sixth),
--         quotes_enforce_pricing_schedule_authorization, quotes_updated_at.

SELECT '=== A11. Section 2 constraints remain present and validated ===' AS verification_step;
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_geographic_scope_check',
                  'quotes_geographic_scope_other_detail_check',
                  'quotes_pricing_schedule_check',
                  'quotes_pricing_schedule_other_detail_check');
-- EXPECT: all captured Section 2 constraints present, convalidated = true.

SELECT '=== A12. RLS policies are unchanged from the capture ===' AS verification_step;
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;
-- EXPECT: identical to the 0_capture.sql query 8 result (External draft
--         updates, Sales Representative owned-quote updates, Estimator/Admin
--         update paths). Q3.4 column protection is provided by the new
--         trigger, NOT by any RLS policy change.

SELECT '=== A13. PostgREST schema reload was issued ===' AS verification_step;
-- 1_forward.sql ends with NOTIFY pgrst, 'reload schema'; confirm the API
-- schema cache picked up the two new columns before running Part B:
--   GET /rest/v1/quotes?limit=0 with apikey headers and
--   Accept-Profile check, or a single authenticated application request.

-- =====================================================================
-- PART B — REAL AUTHENTICATED SESSION TESTS
-- REQUIRES REAL AUTHENTICATED SESSIONS (one per role) via the published
-- application or minted sessions. Cannot be satisfied statically or by
-- running as postgres. Every write below targets a dedicated test row that
-- is deleted afterwards; the 18 live rows are never modified.
-- =====================================================================

SELECT '=== B1. Estimator/Admin can read and write both fields ===' AS verification_step;
-- As estimator (and again as admin):
--   UPDATE public.quotes SET billing_preference = 'annual_upfront'
--     WHERE id = <test-row-id>;                       -> succeeds
--   SELECT billing_preference, billing_preference_other_detail
--     FROM quotes_scoped() WHERE id = <test-row-id>;  -> values returned

SELECT '=== B2. Sales Representative: owned + editable + row visible succeeds ===' AS verification_step;
-- Authoritative rule: a rep reads/writes Q3.4 only when BOTH hold —
--   (a) the UNCHANGED row-scope predicate exposes the row, and
--   (b) owner_id = auth.uid() AND state IN ('draft','estimator_adjusted').
-- For drafts the row predicate keys on requested_by, so the draft case needs
-- requested_by = owner_id = the rep.
--
-- B2a — owned draft that the rep also requested (requested_by = owner_id =
-- rep), and again in state 'estimator_adjusted':
--   UPDATE public.quotes SET billing_preference = 'monthly'
--     WHERE id = <owned-visible-draft-id>;            -> succeeds
--   SELECT billing_preference FROM quotes_scoped()
--     WHERE id = <owned-visible-draft-id>;            -> 'monthly'
--
-- B2b — owned draft the rep did NOT request (owner_id = rep, requested_by =
-- someone else). The write succeeds (the trigger keys on ownership), but the
-- row is NOT returned by quotes_scoped() at all, because the draft branch of
-- the unchanged row predicate keys on requested_by:
--   SELECT count(*) FROM quotes_scoped()
--     WHERE id = <owned-unrequested-draft-id>;        -> 0 rows
-- Record this asymmetry; do NOT widen the predicate to fix it.

SELECT '=== B3. Sales Representative: requested-but-not-owned draft is denied ===' AS verification_step;
-- B3a — requested but NOT owned draft (requested_by = rep, owner_id = other
-- rep). The row IS visible through the unchanged predicate, and must show
-- NULL for both Q3.4 outputs and refuse writes:
--   SELECT billing_preference, billing_preference_other_detail
--     FROM quotes_scoped()
--     WHERE id = <requested-not-owned-draft-id>;      -> NULL, NULL
--   UPDATE public.quotes SET billing_preference = 'monthly'
--     WHERE id = <requested-not-owned-draft-id>;      -> 42501
--   UPDATE public.quotes SET billing_preference_other_detail = 'x'
--     WHERE id = <requested-not-owned-draft-id>;      -> 42501
--
-- B3b — owned but NOT in an editable state (e.g. 'approved' or
-- 'submitted_for_review'):
--   SELECT billing_preference FROM quotes_scoped()
--     WHERE id = <owned-approved-id>;                 -> NULL
--   UPDATE ... SET billing_preference = 'monthly'     -> 42501
--
-- B3c — neither owned nor requested: the row predicate already excludes it
-- for drafts; for non-drafts the sales_rep branch requires owner_id, so the
-- row is not visible and any write raises 42501.
--
-- B3d — draft row visibility is UNCHANGED by this migration. Compare the
-- pre-change and post-change row counts returned by quotes_scoped() for the
-- same rep session: they must be identical.

SELECT '=== B4. External user: no read, no write ===' AS verification_step;
-- As an external user (including on their own draft):
--   SELECT billing_preference FROM quotes_scoped()    -> NULL for both
--     outputs on every visible row;
--   UPDATE public.quotes SET billing_preference = 'monthly'
--     WHERE id = <own-draft-row-id>;                  -> 42501 (trigger);
--   UPDATE public.quotes SET billing_preference_other_detail = 'x'
--     WHERE id = <own-draft-row-id>;                  -> 42501 (trigger).
-- Direct PostgREST reads of the raw columns are additionally blocked by the
-- revoked table SELECT (quotes_scoped() is the only read path).

SELECT '=== B5. Anonymous role: no execute, no write ===' AS verification_step;
-- Without a session:
--   SELECT * FROM quotes_scoped();                    -> permission denied
--   INSERT INTO public.quotes (...) VALUES (..., 'monthly', ...);
--                                                     -> permission denied
-- Public anonymous lead intake must still succeed unchanged
-- (anon_lead_intakes INSERT path; no Q3.4 columns involved).

SELECT '=== B6. Trusted system context (auth.uid() IS NULL) ===' AS verification_step;
-- From a service/system context with no user claim, setting either field
-- succeeds. This is the documented trusted-context convention shared with
-- the Section 2 trigger. Do NOT run this as a client-callable privilege.

SELECT '=== B7. Ballpark and lead-converted compatibility ===' AS verification_step;
-- Convert a lead (or create a Ballpark draft) as usual; confirm the new row
-- has NULL for both Q3.4 fields, the conversion RPCs succeed untouched, and
-- the autosave path persists a rep-selected value only on the Proposal tier.
