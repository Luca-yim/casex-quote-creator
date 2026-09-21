-- Section 2 — VERIFICATION SCRIPT (read-only)
-- Run against the application database after 1_forward.sql.

\echo '=== 1. Columns: types, nullability, and NO defaults ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('geographic_scope','geographic_scope_other_detail',
                      'pricing_schedule','pricing_schedule_other_detail')
ORDER BY ordinal_position;
-- EXPECT: 4 rows, all text / YES (nullable) / null (no default).

\echo '=== 2. Existing rows untouched: NULL counts ==='
SELECT count(*) AS total,
       count(*) FILTER (WHERE geographic_scope IS NULL) AS geo_null,
       count(*) FILTER (WHERE pricing_schedule IS NULL) AS schedule_null,
       count(*) FILTER (WHERE quote_validity_date IS NULL) AS s1_validity_null
FROM public.quotes;
-- EXPECT: geo_null = schedule_null = total (columns are brand new).

\echo '=== 3. Constraints present and VALIDATED ==='
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_geographic_scope_check','quotes_pricing_schedule_check');

\echo '=== 4. Invalid values rejected (expect two errors, then cleanup) ==='
SAVEPOINT s2_probe;
UPDATE public.quotes SET geographic_scope = 'worldwide' WHERE false;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.quotes (name, requested_by, vertical, module_tier, contract_years, hosting_model, support_tier, customer_type, tier, geographic_scope)
    VALUES ('__s2_probe__', '00000000-0000-0000-0000-000000000000', 'famcx', 'standard', 1, 'soc2', 'standard', 'federal', 'ballpark', 'worldwide');
    RAISE NOTICE 'FAIL: invalid geographic_scope accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: invalid geographic_scope rejected';
  END;
  BEGIN
    INSERT INTO public.quotes (name, requested_by, vertical, module_tier, contract_years, hosting_model, support_tier, customer_type, tier, pricing_schedule)
    VALUES ('__s2_probe__', '00000000-0000-0000-0000-000000000000', 'famcx', 'standard', 1, 'soc2', 'standard', 'federal', 'ballpark', 'flat_rate');
    RAISE NOTICE 'FAIL: invalid pricing_schedule accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: invalid pricing_schedule rejected';
  END;
END $$;

\echo '=== 5. quotes_scoped() security properties ==='
SELECT p.prosecdef AS is_security_definer,
       p.provolatile AS volatility,
       p.prolang::regproc AS language,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p
WHERE p.oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: true | s (STABLE) | sql | postgres | {search_path=public}

\echo '=== 6. quotes_scoped() grants (postgres + authenticated only) ==='
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'quotes_scoped'
ORDER BY grantee;

\echo '=== 7. Full definition for diffing against 1_forward.sql ==='
SELECT pg_get_functiondef('public.quotes_scoped()'::regprocedure);

\echo '=== 8. Output columns include the four new fields, no duplicates ==='
SELECT unnest(proargnames) AS output_column, count(*) OVER (PARTITION BY unnest(proargnames)) AS occurrences
FROM pg_proc WHERE oid = 'public.quotes_scoped()'::regprocedure
ORDER BY ordinality;
-- EXPECT: geographic_scope, geographic_scope_other_detail, pricing_schedule,
--         pricing_schedule_other_detail each occur exactly once.

\echo '=== 9. Authorization trigger present ==='
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'quotes_enforce_pricing_schedule_authorization';

\echo '=== 10. quotes RLS policies unchanged (compare to capture baseline) ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;

\echo '=== 11. Phase 1A spot check: pricing_catalog policy/grants intact ==='
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'pricing_catalog';

\echo '=== 12. Lead-conversion RPCs untouched (signatures only) ==='
SELECT p.oid::regprocedure FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('convert_lead_to_quote','claim_and_convert_lead','estimator_assign_and_convert');
