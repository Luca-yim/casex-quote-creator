-- Section 3 / Q3.4 (Billing Preference) — CAPTURE SCRIPT
--
-- CAPTURE STATUS: **COMPLETE** — executed by an authorized operator against
-- the application database. Results recorded inline below and in README.md §1b.
-- Re-run this script immediately before executing 1_forward.sql to confirm the
-- live state has not drifted from the recorded baseline.
--
-- Read-only: no DDL, no DML, no data change.

\echo '=== 1. public.quotes columns (full inventory, ordinal order) ==='
SELECT ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
ORDER BY ordinal_position;
-- CAPTURED: 60 columns.

\echo '=== 2. Existing billing/invoice/payment-related columns ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND (column_name ILIKE '%billing%'
    OR column_name ILIKE '%invoice%'
    OR column_name ILIKE '%payment%');
-- CAPTURED: zero rows. No Billing Preference column and no Billing Preference
-- Other-detail column exist live.

\echo '=== 3. Constraints on public.quotes ==='
SELECT conname, contype, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
ORDER BY conname;
-- CAPTURED: Section 2 constraints present and validated. No Billing
-- Preference constraint exists.

\echo '=== 4. quotes_scoped() full definition (authoritative pre-change baseline) ==='
SELECT pg_get_functiondef('public.quotes_scoped()'::regprocedure);
-- CAPTURED: the operator holds the authoritative pre-change definition. Its
-- verbatim baseline is reproduced in 2_rollback.sql §4 (60 outputs) and,
-- with the two approved Q3.4 outputs appended, in 1_forward.sql §4 (62
-- outputs). Diff this query's fresh output against both before executing
-- either file; if the live function has drifted, STOP and re-baseline.

\echo '=== 5. quotes_scoped() properties ==='
SELECT p.oid::regprocedure          AS function_signature,
       p.prosecdef                  AS is_security_definer,
       p.provolatile                AS volatility,
       p.prolang::regproc           AS language,
       pg_get_userbyid(p.proowner)  AS owner,
       p.proconfig                  AS settings
FROM pg_proc p
WHERE p.oid = 'public.quotes_scoped()'::regprocedure;
-- CAPTURED: SECURITY DEFINER = true; volatility = s (STABLE); language = sql;
-- owner = postgres; settings = search_path = public.

\echo '=== 6. quotes_scoped() output column names AND order (append position) ==='
SELECT ordinality AS output_position, name AS output_column
FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY AS t(name, ordinality)
WHERE p.oid = 'public.quotes_scoped()'::regprocedure
ORDER BY ordinality;
-- CAPTURED: exactly 60 output columns. Final four positions are:
--   57 geographic_scope
--   58 geographic_scope_other_detail
--   59 pricing_schedule
--   60 pricing_schedule_other_detail
-- Any Q3.4 outputs are appended AFTER position 60 only. Positions 1–60 keep
-- their existing names, types and order unchanged.

\echo '=== 7. Function grants (quotes_scoped and the role helper) ==='
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('quotes_scoped','current_user_role')
ORDER BY routine_name, grantee;
-- CAPTURED: EXECUTE for authenticated on quotes_scoped() was observed.
-- The full captured grant set is the restore baseline; no grant may be added
-- or removed by the Q3.4 migration.

\echo '=== 8. public.quotes RLS policies (baseline for post-change diff) ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;
-- CAPTURED: policies include an External draft-update path, a Sales
-- Representative owned-quote update path, and Estimator/Admin update paths.
-- These are NOT modified by the Q3.4 migration. The External draft-update
-- path means external users retain an UPDATE route to their own draft rows,
-- which is why the approved Q3.4 slice adds a separate column-level
-- authorization trigger instead of relying on RLS alone.

\echo '=== 8b. RLS enabled flag ==='
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public.quotes'::regclass;

\echo '=== 9. Non-internal triggers on public.quotes ==='
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;
-- CAPTURED: five triggers —
--   enforce_quote_state
--   notify_quote_reassignment
--   notify_quote_state_change
--   quotes_enforce_pricing_schedule_authorization   (Section 2; must remain
--                                                    behaviourally unchanged)
--   quotes_updated_at
-- All five must be present and behaviourally unchanged after Q3.4.

\echo '=== 10. Row count (baseline; all existing rows must stay NULL) ==='
SELECT count(*) AS quotes_row_count FROM public.quotes;
-- CAPTURED: quote_count = 13.

\echo '=== 11. Name-collision probe for Q3.4 objects ==='
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_billing_preference_check',
                  'quotes_billing_preference_other_detail_check');
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
  AND tgname ILIKE '%billing%';
-- CAPTURED: zero rows for both. No collision.

\echo '=== 12. Section 1 / Section 2 / Q3.1a / Q3.2 columns present (regression baseline) ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('opportunity_stage','deal_priority','deal_template',
                      'quote_validity_date','geographic_scope',
                      'geographic_scope_other_detail','pricing_schedule',
                      'pricing_schedule_other_detail')
ORDER BY column_name;
-- CAPTURED: Section 2 columns present; Section 2 constraints validated.
-- VERIFY.sql asserts this list is unchanged after any future migration.
