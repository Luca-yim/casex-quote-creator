-- =====================================================================
-- Phase 1A — READ-ONLY verification script.
--
-- Contains SELECT statements only. Nothing here modifies data, schema,
-- privileges or configuration.
--
-- RUN IT TWICE:
--   1. BEFORE applying migrations A-D, and SAVE THE OUTPUT. That saved
--      output is the rollback reference — the migrations cannot restore
--      prior grants or search_path values without it.
--   2. AFTER applying, and diff against the saved pre-state.
--
-- Expected outcomes are noted per section.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RLS status for every public table
--    AFTER: rowsecurity = true for pricing_catalog,
--    ballpark_sizing_reference, rate_cards, phase_weight_allocation,
--    vertical_labels, vertical_solutions, past_deployments,
--    pricing_reviews (plus everything already enabled).
-- ---------------------------------------------------------------------
SELECT c.relname               AS table_name,
       c.relrowsecurity        AS rls_enabled,
       c.relforcerowsecurity   AS rls_forced,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;


-- ---------------------------------------------------------------------
-- 2. Table-level grants by role
--    AFTER: anon holds NOTHING on pricing_catalog,
--    ballpark_sizing_reference, rate_cards, phase_weight_allocation,
--    past_deployments, pricing_reviews. anon keeps SELECT on
--    vertical_labels / vertical_solutions and its existing INSERT on
--    lead_intakes.
-- ---------------------------------------------------------------------
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- ---------------------------------------------------------------------
-- 3. Function inventory: definition, security mode, search_path
--    AFTER: every SECURITY DEFINER function in public/private shows
--    proconfig containing search_path. prosecdef = true means SECURITY
--    DEFINER.
--    ALSO USE THIS TO RESOLVE THE OPEN QUESTIONS IN MIGRATION B:
--      - the real argument types of transition_quote
--      - whether _convert_lead_core(...) exists, and its signature
-- ---------------------------------------------------------------------
SELECT n.nspname                                   AS schema,
       p.proname                                   AS function_name,
       pg_get_function_identity_arguments(p.oid)   AS arguments,
       p.prosecdef                                 AS security_definer,
       p.proconfig                                 AS config_settings,
       pg_get_userbyid(p.proowner)                 AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
ORDER BY n.nspname, p.proname;


-- ---------------------------------------------------------------------
-- 4. SECURITY DEFINER functions MISSING a fixed search_path
--    AFTER: this should return ZERO rows.
-- ---------------------------------------------------------------------
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.prosecdef
  AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
ORDER BY 1, 2;


-- ---------------------------------------------------------------------
-- 5. Full source of the functions Phase 1A cares about.
--    Read these bodies before trusting any claim in the Phase 1A report:
--    the conversion RPCs and transition_quote were applied outside the
--    repository and their current logic is unknown to the application team.
-- ---------------------------------------------------------------------
SELECT n.nspname || '.' || p.proname AS fn,
       pg_get_functiondef(p.oid)     AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.proname IN (
    'quotes_scoped', 'quote_versions_scoped', 'transition_quote',
    'convert_lead_to_quote', 'claim_and_convert_lead',
    'estimator_assign_and_convert', '_convert_lead_core',
    'has_role', 'current_user_role', 'handle_new_user',
    'update_updated_at_column', 'prevent_self_role_change',
    'prevent_role_self_escalation', 'force_external_role_on_insert'
  )
ORDER BY 1;


-- ---------------------------------------------------------------------
-- 6. Function EXECUTE grants
--    AFTER: anon has EXECUTE on NO function in public or private.
--    authenticated keeps EXECUTE on quotes_scoped,
--    quote_versions_scoped, transition_quote, convert_lead_to_quote,
--    claim_and_convert_lead, estimator_assign_and_convert,
--    private.has_role, current_user_role.
-- ---------------------------------------------------------------------
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       r.rolname AS grantee,
       has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (SELECT unnest(ARRAY['anon','authenticated','service_role']) AS rolname) r
WHERE n.nspname IN ('public', 'private')
ORDER BY 1, 2, 4;


-- ---------------------------------------------------------------------
-- 7. Every RLS policy, with its roles and expressions
--    REVIEW: any row where roles includes 'public' or 'anon' outside the
--    lead_intakes intake path, and any expression still calling
--    public.has_role (that function was dropped — see investigation item
--    I-5 in migration C).
-- ---------------------------------------------------------------------
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual        AS using_expression,
       with_check  AS check_expression
FROM pg_policies
WHERE schemaname IN ('public', 'private')
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- 8. RLS-enabled tables with NO policies (investigation item I-3)
--    Every row here is either an intentional deny-by-default table
--    (past_deployments, pricing_reviews after migration C) or an
--    accidental lockout. Decide per row.
-- ---------------------------------------------------------------------
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
ORDER BY 1;


-- ---------------------------------------------------------------------
-- 9. Foreign keys with no supporting index (input for migration D)
--    AFTER migration D: the listed FKs should be covered.
-- ---------------------------------------------------------------------
SELECT con.conrelid::regclass AS table_name,
       con.conname            AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_namespace n ON n.oid = con.connamespace
WHERE con.contype = 'f'
  AND n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = con.conrelid
      AND (con.conkey::int[] <@ i.indkey::int[])
  )
ORDER BY 1, 2;


-- ---------------------------------------------------------------------
-- 10. Constraints and triggers on the Phase 1A tables
--     Confirms the trigger set described in docs/*.sql actually exists:
--     on_auth_user_created, profiles_updated_at,
--     profiles_prevent_self_role_change, profiles_role_immutable,
--     profiles_role_default_external, plus the quotes state-machine
--     trigger referenced by docs/SESSION_5B_PERMISSIONS.sql.
-- ---------------------------------------------------------------------
SELECT c.relname AS table_name,
       t.tgname  AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname IN ('public', 'auth')
ORDER BY 1, 2;

SELECT con.conrelid::regclass AS table_name,
       con.conname            AS constraint_name,
       con.contype            AS type,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_namespace n ON n.oid = con.connamespace
WHERE n.nspname = 'public'
  AND con.conrelid::regclass::text IN (
    'pricing_catalog','ballpark_sizing_reference','rate_cards',
    'phase_weight_allocation','lead_intakes','quotes',
    'quote_wbs_lines','quote_cost_items','vertical_labels','vertical_solutions'
  )
ORDER BY 1, 2;


-- ---------------------------------------------------------------------
-- 11. Column-existence checks for the two known repository/schema
--     conflicts. Resolve both before Phase 1B.
--       a) pricing_catalog.naspo_discount_price — READ by
--          src/hooks/usePricingCatalog.ts but ABSENT from the generated
--          types. Expect 1 row; if 0, NASPO pricing is broken at runtime.
--       b) profiles.role — referenced by docs/SECURITY_HARDENING.sql,
--          docs/QUOTE_PDFS_INTERNAL_SCOPE.sql and
--          docs/ADMIN_USER_MANAGEMENT.sql, but ABSENT from the generated
--          types (roles live in user_roles). Expect 0 rows; if 0, those
--          doc scripts were never applied as written.
-- ---------------------------------------------------------------------
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'pricing_catalog' AND column_name = 'naspo_discount_price')
    OR (table_name = 'profiles'        AND column_name = 'role'));
