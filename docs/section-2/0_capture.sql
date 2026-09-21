-- Section 2 (Q2.2 Geographic Scope, Q2.3 Pricing Schedule) — CAPTURE SCRIPT
-- Target: application database (public.quotes, public.quotes_scoped).
-- MANDATORY step zero. Do not run 1_forward.sql unless every query below
-- returns results and matches the expectations recorded in README.md.
-- Read-only: no DDL, no DML.

\echo '=== 1. quotes_scoped() definition (pg_get_functiondef) ==='
SELECT pg_get_functiondef('public.quotes_scoped()'::regprocedure);

\echo '=== 2. quotes_scoped() properties ==='
SELECT p.oid::regprocedure AS function_signature,
       p.prosecdef AS is_security_definer,
       p.provolatile AS volatility,
       p.prolang::regproc AS language,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p
WHERE p.oid = 'public.quotes_scoped()'::regprocedure;

\echo '=== 3. quotes_scoped() grants ==='
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'quotes_scoped'
ORDER BY grantee;

\echo '=== 4. Existing Section 2 columns (must be absent) ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('geographic_scope','geographic_scope_other_detail',
                      'pricing_schedule','pricing_schedule_other_detail');

\echo '=== 5. Existing trigger name collisions (must be empty) ==='
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'quotes_enforce_pricing_schedule_authorization';

\echo '=== 6. public.current_user_role() availability (authorization trigger dependency) ==='
SELECT p.oid::regprocedure AS function_signature,
       p.prosecdef AS is_security_definer,
       p.provolatile AS volatility,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'current_user_role';
-- EXPECT: exactly one row. If empty, STOP — do not run 1_forward.sql.

\echo '=== 6b. current_user_role() grants ==='
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'current_user_role'
ORDER BY grantee;

\echo '=== 7. Dependent objects on quotes_scoped (must be empty, per Section 1 capture) ==='
SELECT dependent.relname AS dependent_view_or_function
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class dependent ON dependent.oid = r.ev_class
WHERE d.refobjid = 'public.quotes_scoped()'::regprocedure
  AND d.deptype = 'n';

\echo '=== 8. quotes RLS policies (baseline to compare after migration) ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;
