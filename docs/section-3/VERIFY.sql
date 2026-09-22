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
-- PART A — FINAL CONSOLIDATED REPORT (LAST STATEMENT IN THE SCRIPT)
--
-- The Supabase SQL editor only displays the result of the final statement,
-- so every static Part A check above is re-evaluated here and returned as a
-- single result set: one row per check.
--   status = PASS   -> verified statically by this query
--   status = FAIL   -> the check did not meet its expected criteria
--   status = REVIEW -> CANNOT be decided statically; requires operator
--                      comparison against the capture, an authorized
--                      transactional test, or a real authenticated session.
-- No temporary tables, no persistent objects, no data modification.
-- =====================================================================

WITH col AS (
  SELECT column_name, data_type, is_nullable, column_default, ordinal_position
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes'
),
q34 AS (
  SELECT count(*) AS n_rows,
         count(*) FILTER (WHERE billing_preference IS NOT NULL)              AS pref_populated,
         count(*) FILTER (WHERE billing_preference_other_detail IS NOT NULL) AS detail_populated,
         count(*) FILTER (WHERE geographic_scope IS NOT NULL)                AS gs_populated,
         count(*) FILTER (WHERE geographic_scope_other_detail IS NOT NULL)   AS gsd_populated,
         count(*) FILTER (WHERE pricing_schedule IS NOT NULL)                AS ps_populated,
         count(*) FILTER (WHERE pricing_schedule_other_detail IS NOT NULL)   AS psd_populated
  FROM public.quotes
),
fn AS (
  SELECT p.oid,
         p.prosecdef,
         p.provolatile::text AS provolatile,
         p.prolang::regproc::text AS lang,
         pg_get_userbyid(p.proowner) AS owner,
         array_to_string(p.proconfig, ',') AS settings,
         p.proargnames
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.quotes_scoped()')
),
cons AS (
  SELECT conname, convalidated
  FROM pg_constraint
  WHERE conrelid = 'public.quotes'::regclass
),
trg AS (
  SELECT tgname, pg_get_triggerdef(oid) AS def
  FROM pg_trigger
  WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
),
grants AS (
  SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND routine_name = 'quotes_scoped'
),
pol AS (
  SELECT count(*) AS n,
         md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' ||
                        coalesce(qual, '') || '|' || coalesce(with_check, ''), E'\n'
                        ORDER BY policyname)) AS policy_md5
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'quotes'
),
report AS (
  -- A0
  SELECT 'A0'::text AS check_id,
         'public.quotes column count'::text AS check_name,
         CASE WHEN (SELECT count(*) FROM col) = 62 THEN 'PASS' ELSE 'FAIL' END AS status,
         '62'::text AS expected,
         (SELECT count(*)::text FROM col) AS actual,
         'Baseline 60 + 2 Q3.4 columns.'::text AS details
  UNION ALL
  -- A1
  SELECT 'A1',
         'Q3.4 columns: text, nullable, no default, positions 61-62',
         CASE WHEN (SELECT count(*) FROM col
                    WHERE column_name IN ('billing_preference','billing_preference_other_detail')
                      AND data_type = 'text' AND is_nullable = 'YES'
                      AND column_default IS NULL) = 2
               AND (SELECT count(*) FROM col
                    WHERE column_name = 'billing_preference' AND ordinal_position = 61) = 1
               AND (SELECT count(*) FROM col
                    WHERE column_name = 'billing_preference_other_detail' AND ordinal_position = 62) = 1
              THEN 'PASS' ELSE 'FAIL' END,
         '2 text / nullable / no default at ordinals 61,62',
         (SELECT coalesce(string_agg(column_name || '=' || data_type || '/' || is_nullable ||
                                     '/default:' || coalesce(column_default,'none') ||
                                     '/pos:' || ordinal_position, '; ' ORDER BY ordinal_position),
                          'missing')
            FROM col
           WHERE column_name IN ('billing_preference','billing_preference_other_detail')),
         'No DEFAULT is authorized on either column.'
  UNION ALL
  -- A2
  SELECT 'A2',
         'Row count and Q3.4 NULL / non-NULL counts',
         CASE WHEN (SELECT pref_populated + detail_populated FROM q34) = 0
                   AND (SELECT n_rows FROM q34) >= 18
              THEN 'PASS' ELSE 'FAIL' END,
         '>= 18 rows (captured baseline 18); 0 populated Q3.4 values',
         (SELECT 'rows=' || n_rows || '; pref_populated=' || pref_populated ||
                 '; detail_populated=' || detail_populated FROM q34),
         'Rows above 18 are tolerated only as normal application activity; all rows must still be NULL.'
  UNION ALL
  -- A2a
  SELECT 'A2a',
         'No backfill and no column defaults',
         CASE WHEN (SELECT pref_populated + detail_populated FROM q34) = 0
                   AND (SELECT count(*) FROM col
                        WHERE column_name IN ('billing_preference','billing_preference_other_detail')
                          AND column_default IS NOT NULL) = 0
              THEN 'PASS' ELSE 'FAIL' END,
         '0 populated values; 0 defaults',
         (SELECT 'populated=' || (pref_populated + detail_populated) FROM q34) || '; defaults=' ||
           (SELECT count(*)::text FROM col
             WHERE column_name IN ('billing_preference','billing_preference_other_detail')
               AND column_default IS NOT NULL),
         'Mirrors the A2a DO block assertion.'
  UNION ALL
  -- A2b
  SELECT 'A2b',
         'Section 2 baseline counts unchanged',
         'REVIEW',
         'Identical to 0_capture.sql query 13 (README §1b)',
         (SELECT 'rows=' || n_rows ||
                 '; geographic_scope_populated=' || gs_populated ||
                 '; geographic_scope_other_detail_populated=' || gsd_populated ||
                 '; pricing_schedule_populated=' || ps_populated ||
                 '; pricing_schedule_other_detail_populated=' || psd_populated FROM q34),
         'Operator must compare these counts against the captured baseline; they cannot be self-verified.'
  UNION ALL
  -- A3
  SELECT 'A3',
         'Q3.4 constraints present and validated',
         CASE WHEN (SELECT count(*) FROM cons
                    WHERE conname IN ('quotes_billing_preference_check',
                                      'quotes_billing_preference_other_detail_check')
                      AND convalidated) = 2
              THEN 'PASS' ELSE 'FAIL' END,
         '2 constraints, convalidated = true',
         (SELECT coalesce(string_agg(conname || '=' || convalidated, '; ' ORDER BY conname), 'missing')
            FROM cons
           WHERE conname IN ('quotes_billing_preference_check',
                             'quotes_billing_preference_other_detail_check')),
         'Option check plus the CASE-form complete Other-detail relationship.'
  UNION ALL
  -- A4 (never auto-passed)
  SELECT 'A4',
         'Constraint truth table — six cases',
         'REVIEW',
         'All six cases behave as documented above',
         'not executed by this report',
         'Requires an authorized transactional test with a real row ID, rolled back. Never marked PASS statically.'
  UNION ALL
  -- A5 / A5b
  SELECT 'A5/A5b',
         'quotes_scoped() has 62 outputs with Q3.4 at 61-62',
         CASE WHEN (SELECT count(*) FROM fn) = 0 THEN 'FAIL'
              WHEN (SELECT array_length(proargnames, 1) FROM fn) = 62
                   AND (SELECT proargnames[61] FROM fn) = 'billing_preference'
                   AND (SELECT proargnames[62] FROM fn) = 'billing_preference_other_detail'
                   AND (SELECT proargnames[57] FROM fn) = 'geographic_scope'
                   AND (SELECT proargnames[58] FROM fn) = 'geographic_scope_other_detail'
                   AND (SELECT proargnames[59] FROM fn) = 'pricing_schedule'
                   AND (SELECT proargnames[60] FROM fn) = 'pricing_schedule_other_detail'
              THEN 'PASS' ELSE 'FAIL' END,
         '62 outputs; 57-60 Section 2; 61 billing_preference; 62 billing_preference_other_detail',
         coalesce((SELECT 'count=' || array_length(proargnames, 1) ||
                          '; 57-62=' || array_to_string(proargnames[57:62], ',') FROM fn),
                  'quotes_scoped() not found'),
         'Byte-identity of outputs 1-60 against the captured definition is an operator diff (see A5 note).'
  UNION ALL
  -- A6
  SELECT 'A6',
         'quotes_scoped() security properties',
         CASE WHEN (SELECT count(*) FROM fn) = 0 THEN 'FAIL'
              WHEN (SELECT prosecdef FROM fn)
                   AND (SELECT provolatile FROM fn) = 's'
                   AND (SELECT lang FROM fn) = 'sql'
                   AND (SELECT owner FROM fn) = 'postgres'
                   AND (SELECT settings FROM fn) = 'search_path=public'
              THEN 'PASS' ELSE 'FAIL' END,
         'SECURITY DEFINER / STABLE / sql / owner postgres / search_path=public',
         coalesce((SELECT 'secdef=' || prosecdef::text || '; volatility=' || provolatile::text ||
                          '; lang=' || lang || '; owner=' || owner ||
                          '; settings=' || coalesce(settings, 'none') FROM fn),
                  'quotes_scoped() not found'),
         'Captured pre-change properties must be preserved exactly.'
  UNION ALL
  -- A7
  SELECT 'A7',
         'quotes_scoped() grants are least privilege',
         CASE WHEN (SELECT count(*) FROM grants WHERE grantee NOT IN ('postgres','authenticated')) = 0
                   AND (SELECT count(*) FROM grants WHERE grantee = 'authenticated' AND privilege_type = 'EXECUTE') = 1
              THEN 'PASS' ELSE 'FAIL' END,
         'EXECUTE for postgres and authenticated only; no anon, PUBLIC or service_role',
         (SELECT coalesce(string_agg(grantee || ':' || privilege_type, '; ' ORDER BY grantee), 'none')
            FROM grants),
         'PUBLIC would appear as an empty/PUBLIC grantee row.'
  UNION ALL
  -- A8
  SELECT 'A8',
         'Q3.4 trigger and function exist with correct scope',
         CASE WHEN (SELECT count(*) FROM trg
                    WHERE tgname = 'quotes_enforce_billing_preference_authorization'
                      AND def ILIKE '%BEFORE INSERT OR UPDATE%'
                      AND def ILIKE '%FOR EACH ROW%'
                      AND def ILIKE '%enforce_billing_preference_authorization()%') = 1
                   AND to_regprocedure('public.enforce_billing_preference_authorization()') IS NOT NULL
              THEN 'PASS' ELSE 'FAIL' END,
         'Trigger BEFORE INSERT OR UPDATE FOR EACH ROW + function present',
         coalesce((SELECT 'trigger present' FROM trg
                    WHERE tgname = 'quotes_enforce_billing_preference_authorization'), 'trigger missing') ||
           '; function=' ||
           CASE WHEN to_regprocedure('public.enforce_billing_preference_authorization()') IS NOT NULL
                THEN 'present' ELSE 'missing' END,
         'Function body details (42501 paths, role rules) are inspected by the A8 pg_get_functiondef output above.'
  UNION ALL
  -- A9
  SELECT 'A9',
         'Section 2 pricing trigger/function present (hash for comparison)',
         CASE WHEN (SELECT count(*) FROM trg
                    WHERE tgname = 'quotes_enforce_pricing_schedule_authorization') = 1
                   AND to_regprocedure('public.enforce_pricing_schedule_authorization()') IS NOT NULL
              THEN 'REVIEW' ELSE 'FAIL' END,
         'Trigger + function present; body md5 identical to the pre-change capture',
         coalesce(
           (SELECT 'md5=' || md5(pg_get_functiondef(to_regprocedure('public.enforce_pricing_schedule_authorization()')))),
           'function missing'),
         'PRESENCE is verified here; UNCHANGED requires the operator to compare this md5 with the captured value.'
  UNION ALL
  -- A10
  SELECT 'A10',
         'All five original triggers plus the new Q3.4 trigger',
         CASE WHEN (SELECT count(*) FROM trg
                    WHERE tgname IN ('enforce_quote_state',
                                     'notify_quote_reassignment',
                                     'notify_quote_state_change',
                                     'quotes_enforce_pricing_schedule_authorization',
                                     'quotes_updated_at',
                                     'quotes_enforce_billing_preference_authorization')) = 6
                   AND (SELECT count(*) FROM trg) = 6
              THEN 'PASS' ELSE 'FAIL' END,
         '6 non-internal triggers: the 5 captured + quotes_enforce_billing_preference_authorization',
         (SELECT coalesce(string_agg(tgname, '; ' ORDER BY tgname), 'none') FROM trg),
         'No captured trigger may be dropped, renamed or replaced.'
  UNION ALL
  -- A11
  SELECT 'A11',
         'Section 2 constraints present and validated',
         CASE WHEN (SELECT count(*) FROM cons
                    WHERE conname IN ('quotes_geographic_scope_check',
                                      'quotes_geographic_scope_other_detail_check',
                                      'quotes_pricing_schedule_check',
                                      'quotes_pricing_schedule_other_detail_check')
                      AND convalidated) = 4
              THEN 'PASS' ELSE 'FAIL' END,
         '4 Section 2 constraints, convalidated = true',
         (SELECT coalesce(string_agg(conname || '=' || convalidated, '; ' ORDER BY conname), 'missing')
            FROM cons
           WHERE conname IN ('quotes_geographic_scope_check',
                             'quotes_geographic_scope_other_detail_check',
                             'quotes_pricing_schedule_check',
                             'quotes_pricing_schedule_other_detail_check')),
         'Section 2 behaviour must be untouched by Q3.4.'
  UNION ALL
  -- A12
  SELECT 'A12',
         'RLS policies unchanged (canonical hash)',
         'REVIEW',
         'Policy set and md5 identical to 0_capture.sql query 8',
         (SELECT 'policies=' || n || '; md5=' || coalesce(policy_md5, 'none') FROM pol),
         'Q3.4 protection comes from the new trigger, not from any RLS change. Operator compares this md5 with the capture.'
  UNION ALL
  -- A13
  SELECT 'A13',
         'PostgREST schema reload',
         'REVIEW',
         'NOTIFY pgrst, ''reload schema'' issued and API cache refreshed',
         'not observable from the database catalog',
         'Confirm via an authenticated application request or a REST call before running Part B.'
  UNION ALL
  -- PART B
  SELECT 'PART B',
         'Authenticated role behaviour (B1-B7)',
         'REVIEW',
         'Each B case verified in a real authenticated session',
         'not executed by this report',
         'Requires real per-role sessions (estimator, admin, sales_rep, external, anonymous, trusted context). Never marked PASS statically.'
)
SELECT check_id, check_name, status, expected, actual, details
FROM report
ORDER BY CASE status WHEN 'FAIL' THEN 0 WHEN 'REVIEW' THEN 1 ELSE 2 END, check_id;

-- =====================================================================
-- PART B — REAL AUTHENTICATED SESSION TESTS
-- REQUIRES REAL AUTHENTICATED SESSIONS (one per role) via the published
-- application or minted sessions. Cannot be satisfied statically or by
-- running as postgres. Every write below targets a dedicated test row that
-- is deleted afterwards; the 18 live rows are never modified.
-- =====================================================================

-- === B1. Estimator/Admin can read and write both fields === (documentation only — not executed; see PART B note)
-- As estimator (and again as admin):
--   UPDATE public.quotes SET billing_preference = 'annual_upfront'
--     WHERE id = <test-row-id>;                       -> succeeds
--   SELECT billing_preference, billing_preference_other_detail
--     FROM quotes_scoped() WHERE id = <test-row-id>;  -> values returned

-- === B2. Sales Representative: owned + editable + row visible succeeds === (documentation only — not executed; see PART B note)
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

-- === B3. Sales Representative: requested-but-not-owned draft is denied === (documentation only — not executed; see PART B note)
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

-- === B4. External user: no read, no write === (documentation only — not executed; see PART B note)
-- As an external user (including on their own draft):
--   SELECT billing_preference FROM quotes_scoped()    -> NULL for both
--     outputs on every visible row;
--   UPDATE public.quotes SET billing_preference = 'monthly'
--     WHERE id = <own-draft-row-id>;                  -> 42501 (trigger);
--   UPDATE public.quotes SET billing_preference_other_detail = 'x'
--     WHERE id = <own-draft-row-id>;                  -> 42501 (trigger).
-- Direct PostgREST reads of the raw columns are additionally blocked by the
-- revoked table SELECT (quotes_scoped() is the only read path).

-- === B5. Anonymous role: no execute, no write === (documentation only — not executed; see PART B note)
-- Without a session:
--   SELECT * FROM quotes_scoped();                    -> permission denied
--   INSERT INTO public.quotes (...) VALUES (..., 'monthly', ...);
--                                                     -> permission denied
-- Public anonymous lead intake must still succeed unchanged
-- (anon_lead_intakes INSERT path; no Q3.4 columns involved).

-- === B6. Trusted system context (auth.uid() IS NULL) === (documentation only — not executed; see PART B note)
-- From a service/system context with no user claim, setting either field
-- succeeds. This is the documented trusted-context convention shared with
-- the Section 2 trigger. Do NOT run this as a client-callable privilege.

-- === B7. Ballpark and lead-converted compatibility === (documentation only — not executed; see PART B note)
-- Convert a lead (or create a Ballpark draft) as usual; confirm the new row
-- has NULL for both Q3.4 fields, the conversion RPCs succeed untouched, and
-- the autosave path persists a rep-selected value only on the Proposal tier.
