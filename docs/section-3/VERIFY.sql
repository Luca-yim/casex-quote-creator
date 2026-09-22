-- Section 3 / Q3.4 (Billing Preference) — VERIFICATION **DRAFT**
-- Run against the application database AFTER 1_forward.sql (which is itself
-- a draft pending authorized-operator review; re-run 0_capture.sql first to
-- confirm no drift).
--
-- Baseline from the COMPLETED live capture (0_capture.sql; README.md §1b):
--   public.quotes = 60 columns, 13 rows.
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
-- =====================================================================

\echo '=== A0. Column count moved from 60 to 62 ==='
SELECT count(*) AS quotes_column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes';
-- EXPECT: 62.

\echo '=== A1. Q3.4 columns: type, nullability, NO default ==='
SELECT column_name, data_type, is_nullable, column_default, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('billing_preference','billing_preference_other_detail')
ORDER BY ordinal_position;
-- EXPECT: two rows, text / YES / null. Expected ordinal positions 61 and 62.

\echo '=== A2. All 13 captured rows remain NULL; row count unchanged ==='
SELECT count(*) AS total,
       count(*) FILTER (WHERE billing_preference IS NULL)              AS pref_null,
       count(*) FILTER (WHERE billing_preference_other_detail IS NULL) AS detail_null
FROM public.quotes;
-- EXPECT: total = 13 (captured baseline; higher only if rows were created
--         through normal application use since capture), and
--         pref_null = detail_null = total. Nullable columns with no default
--         and no backfill must leave every pre-existing row NULL.

\echo '=== A3. Both constraints present and VALIDATED ==='
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_billing_preference_check',
                  'quotes_billing_preference_other_detail_check');
-- EXPECT: two rows, convalidated = true. The option check permits NULL or
--         one of monthly / annual_upfront / annual_quarterly / other; the
--         Other-detail check requires a nonblank (btrim) detail only when
--         billing_preference = 'other'.

\echo '=== A4. Invalid option values rejected; approved values accepted ==='
-- Operator note: run inside an explicit transaction that is ROLLED BACK. It
-- must not leave any of the 13 rows modified.
--   UPDATE public.quotes SET billing_preference = 'weekly' WHERE id = <id>;
--     -> check_violation (quotes_billing_preference_check)
--   UPDATE public.quotes SET billing_preference = 'annual_quarterly'
--     WHERE id = <id>; -> succeeds
--   UPDATE public.quotes SET billing_preference = 'other' WHERE id = <id>;
--     -> check_violation (quotes_billing_preference_other_detail_check:
--        NULL detail alongside Other is rejected at the database layer)
--   UPDATE public.quotes SET billing_preference = 'other',
--          billing_preference_other_detail = '   ' WHERE id = <id>;
--     -> check_violation (whitespace-only detail is rejected via btrim)
--   UPDATE public.quotes SET billing_preference = 'other',
--          billing_preference_other_detail = 'Milestone invoicing'
--     WHERE id = <id>; -> succeeds
-- Then ROLLBACK and re-run A2 to confirm all rows are NULL again.

\echo '=== A5. quotes_scoped() output columns — count, order, append position ==='
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

\echo '=== A5b. Output column count ==='
SELECT array_length(proargnames, 1) AS output_column_count
FROM pg_proc WHERE oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: 62.

\echo '=== A6. quotes_scoped() security properties unchanged ==='
SELECT p.prosecdef AS is_security_definer,
       p.provolatile AS volatility,
       p.prolang::regproc AS language,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p
WHERE p.oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: true / s (STABLE) / sql / postgres / search_path = public.

\echo '=== A7. quotes_scoped() grants remain least privilege ==='
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'quotes_scoped';
-- EXPECT: EXECUTE for postgres and authenticated ONLY. No anon, no PUBLIC,
--         no service_role.

\echo '=== A8. Q3.4 trigger and function exist with correct scope ==='
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

\echo '=== A9. The existing pricing authorization trigger is UNCHANGED ==='
SELECT md5(pg_get_functiondef('public.enforce_pricing_schedule_authorization()'::regprocedure)) AS section2_fn_md5;
-- EXPECT: identical hash to the pre-change capture. Compare with the value
--         recorded by 0_capture.sql before the migration.
SELECT tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
  AND t.tgname = 'quotes_enforce_pricing_schedule_authorization';
-- EXPECT: BEFORE INSERT OR UPDATE, unchanged from the capture.

\echo '=== A10. All five original non-internal triggers remain present ==='
SELECT t.tgname
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;
-- EXPECT: enforce_quote_state, notify_quote_reassignment,
--         notify_quote_state_change,
--         quotes_enforce_billing_preference_authorization (the new sixth),
--         quotes_enforce_pricing_schedule_authorization, quotes_updated_at.

\echo '=== A11. Section 2 constraints remain present and validated ==='
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_geographic_scope_check',
                  'quotes_geographic_scope_other_detail_check',
                  'quotes_pricing_schedule_check',
                  'quotes_pricing_schedule_other_detail_check');
-- EXPECT: all captured Section 2 constraints present, convalidated = true.

\echo '=== A12. RLS policies are unchanged from the capture ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;
-- EXPECT: identical to the 0_capture.sql query 8 result (External draft
--         updates, Sales Representative owned-quote updates, Estimator/Admin
--         update paths). Q3.4 column protection is provided by the new
--         trigger, NOT by any RLS policy change.

\echo '=== A13. PostgREST schema reload was issued ==='
-- 1_forward.sql ends with NOTIFY pgrst, 'reload schema'; confirm the API
-- schema cache picked up the two new columns before running Part B:
--   GET /rest/v1/quotes?limit=0 with apikey headers and
--   Accept-Profile check, or a single authenticated application request.

-- =====================================================================
-- PART B — REAL AUTHENTICATED SESSION TESTS
-- REQUIRES REAL AUTHENTICATED SESSIONS (one per role) via the published
-- application or minted sessions. Cannot be satisfied statically or by
-- running as postgres. Every write below targets a dedicated test row that
-- is deleted afterwards; the 13 live rows are never modified.
-- =====================================================================

\echo '=== B1. Estimator/Admin can read and write both fields ==='
-- As estimator (and again as admin):
--   UPDATE public.quotes SET billing_preference = 'annual_upfront'
--     WHERE id = <test-row-id>;                       -> succeeds
--   SELECT billing_preference, billing_preference_other_detail
--     FROM quotes_scoped() WHERE id = <test-row-id>;  -> values returned

\echo '=== B2. Sales Representative: owned + editable state succeeds ==='
-- As a sales rep who OWNS a test row in state 'draft' (and again in
-- 'estimator_adjusted'):
--   UPDATE public.quotes SET billing_preference = 'monthly'
--     WHERE id = <owned-draft-row-id>;                -> succeeds
--   SELECT billing_preference FROM quotes_scoped()
--     WHERE id = <owned-draft-row-id>;                -> 'monthly'

\echo '=== B3. Sales Representative: unowned or non-editable state is rejected ==='
-- As a sales rep who does NOT own the row (state 'draft'):
--   UPDATE ... SET billing_preference = 'monthly'     -> 42501
-- As a sales rep who owns the row but it is in state 'approved':
--   UPDATE ... SET billing_preference = 'monthly'     -> 42501
-- Reading through quotes_scoped() for a non-editable owned state returns
-- NULL for both Q3.4 outputs.

\echo '=== B4. External user: no read, no write ==='
-- As an external user (including on their own draft):
--   SELECT billing_preference FROM quotes_scoped()    -> NULL for both
--     outputs on every visible row;
--   UPDATE public.quotes SET billing_preference = 'monthly'
--     WHERE id = <own-draft-row-id>;                  -> 42501 (trigger);
--   UPDATE public.quotes SET billing_preference_other_detail = 'x'
--     WHERE id = <own-draft-row-id>;                  -> 42501 (trigger).
-- Direct PostgREST reads of the raw columns are additionally blocked by the
-- revoked table SELECT (quotes_scoped() is the only read path).

\echo '=== B5. Anonymous role: no execute, no write ==='
-- Without a session:
--   SELECT * FROM quotes_scoped();                    -> permission denied
--   INSERT INTO public.quotes (...) VALUES (..., 'monthly', ...);
--                                                     -> permission denied
-- Public anonymous lead intake must still succeed unchanged
-- (anon_lead_intakes INSERT path; no Q3.4 columns involved).

\echo '=== B6. Trusted system context (auth.uid() IS NULL) ==='
-- From a service/system context with no user claim, setting either field
-- succeeds. This is the documented trusted-context convention shared with
-- the Section 2 trigger. Do NOT run this as a client-callable privilege.

\echo '=== B7. Ballpark and lead-converted compatibility ==='
-- Convert a lead (or create a Ballpark draft) as usual; confirm the new row
-- has NULL for both Q3.4 fields, the conversion RPCs succeed untouched, and
-- the autosave path persists a rep-selected value only on the Proposal tier.
