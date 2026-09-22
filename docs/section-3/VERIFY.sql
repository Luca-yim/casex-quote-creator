-- Section 3 / Q3.4 (Billing Preference) — VERIFICATION **DRAFT**
-- Run against the application database AFTER 1_forward.sql.
-- Part A is static/catalog only and safe to run as the migration operator.
-- Part B REQUIRES REAL AUTHENTICATED SESSIONS and cannot be satisfied by
-- static inspection or by running as postgres.

-- =====================================================================
-- PART A — STATIC / CATALOG CHECKS (no session role required)
-- =====================================================================

\echo '=== A1. Q3.4 columns: type, nullability, NO default ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('billing_preference','billing_preference_other_detail')
ORDER BY ordinal_position;
-- EXPECT: 2 rows, text / YES / null.

\echo '=== A2. Existing rows remain NULL; row count unchanged ==='
SELECT count(*) AS total,
       count(*) FILTER (WHERE billing_preference IS NULL)              AS pref_null,
       count(*) FILTER (WHERE billing_preference_other_detail IS NULL) AS detail_null
FROM public.quotes;
-- EXPECT: pref_null = detail_null = total, and total = the 0_capture.sql
--         query 10 baseline.

\echo '=== A3. Constraints present and VALIDATED ==='
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_billing_preference_check',
                  'quotes_billing_preference_other_detail_check');
-- EXPECT: 2 rows, convalidated = true.

\echo '=== A4. Invalid option values rejected; valid ones accepted ==='
DO $$
BEGIN
  BEGIN
    UPDATE public.quotes SET billing_preference = 'weekly' WHERE id = (SELECT id FROM public.quotes LIMIT 1);
    RAISE EXCEPTION 'FAIL: invalid billing_preference accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: invalid billing_preference rejected';
  END;
  RAISE EXCEPTION 'rollback probe';   -- never persist probe writes
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'probe transaction discarded';
END $$;
-- Operator note: run this block inside an explicit transaction that is
-- ROLLED BACK. It must not leave any row modified.

\echo '=== A5. "Other" detail rule (only if decision D3 approved DB enforcement) ==='
-- EXPECT (draft D3 = Zod only): detail text is rejected when the preference
-- is not 'other'; a NULL detail alongside 'other' is ACCEPTED at the
-- database level and is enforced only by application validation.

\echo '=== A6. quotes_scoped() output columns — presence, uniqueness, position ==='
SELECT ordinality AS output_position, name AS output_column
FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY AS t(name, ordinality)
WHERE p.oid = 'public.quotes_scoped()'::regprocedure
ORDER BY ordinality;
-- EXPECT: identical to the 0_capture.sql query 6 list, with exactly two new
--         entries APPENDED at the end: billing_preference then
--         billing_preference_other_detail. No reordering, no duplicates,
--         no removals.

\echo '=== A7. quotes_scoped() security properties unchanged ==='
SELECT p.prosecdef AS is_security_definer, p.provolatile AS volatility,
       p.prolang::regproc AS language, pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p WHERE p.oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: byte-identical to the captured baseline.

\echo '=== A8. Grants remain least privilege ==='
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('quotes_scoped','current_user_role')
ORDER BY routine_name, grantee;
-- EXPECT: identical to the captured baseline. NO EXECUTE for anon or PUBLIC.

\echo '=== A9. Full definition for diffing against the captured baseline ==='
SELECT pg_get_functiondef('public.quotes_scoped()'::regprocedure);
-- EXPECT: differs from the baseline ONLY by the two appended outputs and the
--         two appended masking expressions.

\echo '=== S2-1. Section 1 / Section 2 columns still present and unchanged ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('opportunity_stage','deal_priority','deal_template',
                      'quote_validity_date','geographic_scope',
                      'geographic_scope_other_detail','pricing_schedule',
                      'pricing_schedule_other_detail')
ORDER BY column_name;

\echo '=== S2-2. Section 2 constraints still present ==='
SELECT conname, convalidated FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_geographic_scope_check','quotes_pricing_schedule_check');

\echo '=== S2-3. Section 2 authorization trigger still present on INSERT and UPDATE ==='
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'quotes_enforce_pricing_schedule_authorization'
ORDER BY event_manipulation;
-- EXPECT: two rows, BEFORE INSERT and BEFORE UPDATE.

\echo '=== S2-4. No Q3.4 trigger was introduced (decision D4) ==='
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
  AND tgname ILIKE '%billing%';
-- EXPECT: zero rows.

\echo '=== S2-5. quotes RLS policies unchanged ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;
-- EXPECT: identical to the 0_capture.sql query 8 baseline.

\echo '=== S2-6. Lead-conversion RPCs untouched (signatures only) ==='
SELECT p.oid::regprocedure FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('convert_lead_to_quote','claim_and_convert_lead','estimator_assign_and_convert');

\echo '=== S2-7. No Ballpark / public-intake database behaviour changed ==='
-- Ballpark quotes are tier = ''ballpark'' rows; they receive no Q3.4 value.
SELECT count(*) AS ballpark_rows,
       count(*) FILTER (WHERE billing_preference IS NOT NULL) AS ballpark_with_billing
FROM public.quotes WHERE tier = 'ballpark';
-- EXPECT: ballpark_with_billing = 0.
-- Public intake writes to public.leads, which this migration does not touch;
-- confirm no billing column exists there:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name ILIKE '%billing%';
-- EXPECT: zero rows.

-- =====================================================================
-- PART B — AUTHENTICATED-SESSION CHECKS
-- REQUIRES REAL SESSIONS. Cannot be satisfied statically, cannot be run as
-- postgres (auth.uid() IS NULL is the trusted context and bypasses masking
-- semantics). Record the actual observed output for each role.
-- =====================================================================

-- B1. As an ESTIMATOR session:
--       SELECT billing_preference, billing_preference_other_detail
--       FROM public.quotes_scoped() LIMIT 5;
--     EXPECT: real values returned.
-- B2. As an ADMIN session: same expectation as B1.
-- B3. As a SALES_REP session on a quote they may see: real values returned
--     (Q3.4 is rep-visible, unlike pricing_schedule_other_detail).
-- B4. As an EXTERNAL session: both columns return NULL for every row.
-- B5. As an EXTERNAL session via PostgREST: confirm the app's external
--     projection never requests these columns and the raw network response
--     contains no billing values.
-- B6. WRITE checks — as sales_rep, estimator and admin: setting
--     billing_preference to each of 'monthly', 'annual_upfront',
--     'annual_quarterly', 'other' succeeds on a quote they own/may edit.
-- B7. WRITE check — as external: the write is refused by the existing quotes
--     RLS policies (no new trigger exists). Record the actual error.
-- B8. As anon/public: no insert or update path to public.quotes at all.
-- B9. Lead conversion as a real session: converted quotes are created with
--     billing_preference NULL and conversion succeeds unchanged.
-- B10. Ballpark end-to-end as a real session: unchanged behaviour, no Q3.4
--      field rendered, totals identical to the pre-change run.
