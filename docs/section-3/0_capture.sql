-- Section 3 / Q3.4 (Billing Preference) — CAPTURE SCRIPT
-- Target: application database (public.quotes, public.quotes_scoped).
-- MANDATORY step zero. 1_forward.sql is a DRAFT and must NOT be executed
-- until every query below has been run by an authorized operator and its
-- output pasted into the placeholders in 1_forward.sql / 2_rollback.sql.
-- Read-only: no DDL, no DML, no data change.

\echo '=== 1. public.quotes columns (full inventory, ordinal order) ==='
SELECT ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
ORDER BY ordinal_position;

\echo '=== 2. Existing billing/invoice/payment-related columns (EXPECT: zero rows) ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND (column_name ILIKE '%billing%'
    OR column_name ILIKE '%invoice%'
    OR column_name ILIKE '%payment%');
-- If ANY row is returned, STOP: a live column already exists that the
-- repository does not know about. Re-scope the package before proceeding.

\echo '=== 3. Constraints on public.quotes ==='
SELECT conname, contype, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
ORDER BY conname;

\echo '=== 4. quotes_scoped() full definition (paste into the placeholders) ==='
SELECT pg_get_functiondef('public.quotes_scoped()'::regprocedure);

\echo '=== 5. quotes_scoped() properties ==='
SELECT p.oid::regprocedure          AS function_signature,
       p.prosecdef                  AS is_security_definer,
       p.provolatile                AS volatility,
       p.prolang::regproc           AS language,
       pg_get_userbyid(p.proowner)  AS owner,
       p.proconfig                  AS settings
FROM pg_proc p
WHERE p.oid = 'public.quotes_scoped()'::regprocedure;

\echo '=== 6. quotes_scoped() output column names AND order (append position) ==='
SELECT ordinality AS output_position, name AS output_column
FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY AS t(name, ordinality)
WHERE p.oid = 'public.quotes_scoped()'::regprocedure
ORDER BY ordinality;
-- Record the final ordinal. Q3.4 outputs are appended AFTER it, never inserted.

\echo '=== 7. Function grants (quotes_scoped and the role helper) ==='
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('quotes_scoped','current_user_role')
ORDER BY routine_name, grantee;

\echo '=== 8. public.quotes RLS policies (baseline for post-change diff) ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;

\echo '=== 8b. RLS enabled flag ==='
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public.quotes'::regclass;

\echo '=== 9. Non-internal triggers on public.quotes ==='
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.quotes'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;

\echo '=== 10. Row count (baseline; all existing rows must stay NULL) ==='
SELECT count(*) AS quotes_row_count FROM public.quotes;

\echo '=== 11. Name-collision probe for Q3.4 objects (EXPECT: zero rows each) ==='
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_billing_preference_check',
                  'quotes_billing_preference_other_detail_check');
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
  AND tgname LIKE '%billing%';

\echo '=== 12. Section 1 / Section 2 / Q3.1a / Q3.2 columns still present (regression baseline) ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('opportunity_stage','deal_priority','deal_template',
                      'quote_validity_date','geographic_scope',
                      'geographic_scope_other_detail','pricing_schedule',
                      'pricing_schedule_other_detail')
ORDER BY column_name;
-- Record this list verbatim; VERIFY.sql asserts it is unchanged afterwards.
