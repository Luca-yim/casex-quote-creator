-- =====================================================================
-- Phase 1A — READ-ONLY verification script (REVISED 2026-09-18).
--
-- Contains SELECT statements only. Nothing here modifies data, schema,
-- privileges or configuration.
--
-- RUN IT TWICE:
--   1. BEFORE applying migrations A/B/C (+ 0 if its condition fires),
--      and SAVE THE OUTPUT. That saved output is the rollback reference —
--      the migrations cannot restore prior grants or configuration
--      without it.
--   2. AFTER applying, and diff against the saved pre-state.
--
-- New in this revision: sections 2b and 6 use has_table_privilege() /
-- has_function_privilege() so the check reflects EFFECTIVE privileges
-- (including role inheritance and PUBLIC), not just information_schema
-- rows. Sections 2c, 6b, 8b and 10 are new focused checks.
--
-- NOTE ON SCOPE: nothing here asserts that anon function execution is
-- removed globally. Section 6 REPORTS remaining grants for review; the
-- DBA decides per function whether each remaining grant is intended.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RLS status for every public table
--    AFTER (minimal set): rowsecurity = true for pricing_catalog,
--    vertical_labels, vertical_solutions (plus everything already
--    enabled). Tables NOT in scope of Phase 1A are listed too — that is
--    the point: record their state, do not change it.
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
-- 2. Table-level grants by role (information_schema view)
--    AFTER: anon holds NOTHING on pricing_catalog. anon keeps SELECT on
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
-- 2b. EFFECTIVE table privileges via has_table_privilege() — NEW.
--     Use this to settle what each role can ACTUALLY do, including via
--     PUBLIC. AFTER: pricing_catalog must show SELECT/INSERT/UPDATE for
--     authenticated (with admin-only policies on top), no DELETE for
--     authenticated, and NOTHING for anon. quote_wbs_lines and
--     quote_cost_items must show NO authenticated privilege at all
--     (preserved Estimator/Admin-only posture is enforced via RLS
--     policies, not grants — see section 8b).
-- ---------------------------------------------------------------------
SELECT c.relname AS table_name, r.rolname AS role,
       has_table_privilege(r.rolname, c.oid, 'SELECT')     AS can_select,
       has_table_privilege(r.rolname, c.oid, 'INSERT')     AS can_insert,
       has_table_privilege(r.rolname, c.oid, 'UPDATE')     AS can_update,
       has_table_privilege(r.rolname, c.oid, 'DELETE')     AS can_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('public'),('anon'),('authenticated'),('service_role')) AS r(rolname)
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'pricing_catalog', 'ballpark_sizing_reference', 'rate_cards',
    'phase_weight_allocation', 'vertical_labels', 'vertical_solutions',
    'lead_intakes', 'quotes', 'quote_versions',
    'quote_wbs_lines', 'quote_cost_items'
  )
ORDER BY c.relname, r.rolname;


-- ---------------------------------------------------------------------
-- 3. Function inventory: definition, security mode, search_path
--    AFTER: only the changes Migration B makes are visible — namely
--    handle_new_user()'s proconfig. Everything else should be byte-identical
--    to the pre-state. ALSO USE THIS TO RESOLVE THE OPEN QUESTIONS:
--      - the real argument types of transition_quote
--      - whether _convert_lead_core(...) exists, its schema and signature
--      - the full definition of enforce_quote_state_transition (section 5)
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
--    Phase 1A deliberately fixes ONLY handle_new_user(). Every other row
--    here is REPORTED FOR REVIEW, not batch-fixed. AFTER: this section
--    should show exactly which functions still lack a pinned search_path
--    so the DBA can judge each one.
-- ---------------------------------------------------------------------
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.prosecdef
  AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
ORDER BY 1, 2;


-- ---------------------------------------------------------------------
-- 5. Full source of the functions Phase 1A cares about.
--    Read these bodies before trusting any claim:
--      * enforce_quote_state_transition — THE DECISIVE CHECK for whether
--        sales_rep/external callers can reach state = 'approved'. Feed the
--        output to the condition in 0_approval_transition_fix.sql.
--      * transition_quote — same question, wrapper side.
--      * _convert_lead_core — signature + prosecdef, which gate the
--        guarded revoke in Migration B section 3.
--    All were applied outside the repository; their logic is unknown to
--    the application team without this output.
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
    'enforce_quote_state_transition',
    'has_role', 'current_user_role', 'handle_new_user',
    'update_updated_at_column', 'prevent_self_role_change',
    'prevent_role_self_escalation', 'force_external_role_on_insert'
  )
ORDER BY 1;


-- ---------------------------------------------------------------------
-- 6. Function EXECUTE grants — REPORT ONLY, no global claim.
--    Lists every function in public/private with whether PUBLIC, anon,
--    authenticated and service_role hold EXECUTE. The DBA reviews the
--    remaining grants row by row; this script does NOT assert they are
--    all removed.
--    AFTER (expected for the six client RPCs): anon = false, PUBLIC = false,
--    authenticated = true. service_role columns are informational —
--    Migration B grants service_role NOTHING, so any true here was
--    pre-existing (e.g. via PUBLIC before Migration B) and should be
--    re-checked after applying.
-- ---------------------------------------------------------------------
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       r.rolname AS grantee,
       has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('public'),('anon'),('authenticated'),('service_role')) AS r(rolname)
WHERE n.nspname IN ('public', 'private')
ORDER BY 1, 2, 5;


-- ---------------------------------------------------------------------
-- 6b. FOCUSED: _convert_lead_core(...) — NEW.
--     Gate for Migration B section 3. Safe to revoke EXECUTE from
--     authenticated ONLY IF wrappers_are_definer = true (all three
--     wrappers SECURITY DEFINER). If any row shows false, DO NOT apply
--     Migration B section 3 — it would break lead conversion.
-- ---------------------------------------------------------------------
SELECT p.oid::regprocedure AS core_signature,
       p.prosecdef AS core_is_definer,
       (SELECT bool_and(w.prosecdef)
        FROM pg_proc w
        JOIN pg_namespace wn ON wn.oid = w.pronamespace
        WHERE wn.nspname = 'public'
          AND w.proname IN ('convert_lead_to_quote','claim_and_convert_lead',
                            'estimator_assign_and_convert')
       ) AS wrappers_are_definer,
       EXISTS (
        SELECT 1 FROM pg_proc w
        JOIN pg_namespace wn ON wn.oid = w.pronamespace
        WHERE wn.nspname = 'public'
          AND w.proname IN ('convert_lead_to_quote','claim_and_convert_lead',
                            'estimator_assign_and_convert')
          AND NOT w.prosecdef
       ) AS any_wrapper_security_invoker
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = '_convert_lead_core';


-- ---------------------------------------------------------------------
-- 7. Every RLS policy, with its roles and expressions
--    REVIEW: any row where roles includes 'public' or 'anon' outside the
--    lead_intakes intake path and the vertical_labels/vertical_solutions
--    read policies, and any expression still calling public.has_role
--    (that function was dropped — see investigation item I-5 in
--    migration C).
-- ---------------------------------------------------------------------
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual        AS using_expression,
       with_check  AS check_expression
FROM pg_policies
WHERE schemaname IN ('public', 'private')
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- 8. RLS-enabled tables with NO policies
--    Every row is either an intentional deny-by-default table or an
--    accidental lockout. Phase 1A does NOT add policies to any table
--    listed here except via migrations A/B/C scope — decide per row.
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
-- 8b. FOCUSED: quote_wbs_lines and quote_cost_items — NEW.
--     Phase 1A PRESERVES their access as-is (Estimator/Admin-only,
--     unverified). Capture RLS state, every policy, and effective
--     privileges so the pre-state is on record before any later phase
--     touches them. NO change is asserted by this section.
-- ---------------------------------------------------------------------
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       p.policyname, p.roles, p.cmd,
       p.qual AS using_expression, p.with_check AS check_expression
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN ('quote_wbs_lines', 'quote_cost_items')
ORDER BY c.relname, p.policyname;


-- ---------------------------------------------------------------------
-- 9. Foreign keys with no supporting index (input for the DEFERRED
--    migration D). Migration D is NOT part of minimal Phase 1A; this
--    section stays as the input list for the later performance pass.
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
-- 10. Column type / nullability / default checks — NEW.
--     Resolves the two schema CONFLICTs flagged in the audit:
--       * profiles.role        — docs/SECURITY_HARDENING.sql and
--         docs/QUOTE_PDFS_INTERNAL_SCOPE.sql read it; the generated types
--         (src/lib/database.types.ts:140) show no such column. If row 1
--         returns nothing, those policies were never applied or reference
--         a dropped column.
--       * pricing_catalog.naspo_discount_price — read by application code
--         (src/hooks/usePricingCatalog.ts) but absent from the generated
--         types. If row 2 returns nothing, application code will error at
--         runtime.
--     No change is asserted; this records the truth.
-- ---------------------------------------------------------------------
SELECT 'profiles.role' AS check_name, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name = 'role';

SELECT 'pricing_catalog.naspo_discount_price' AS check_name, column_name,
       data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pricing_catalog'
  AND column_name = 'naspo_discount_price';

-- ---------------------------------------------------------------------
-- END. Sections 2b, 6, 6b, 8b and 10 are new in this revision.
-- ---------------------------------------------------------------------
