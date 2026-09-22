-- Section 3 / Q3.4 (Billing Preference) — VERIFICATION **DRAFT**
-- Run against the application database AFTER 1_forward.sql (which is itself
-- a non-executable draft pending approval).
--
-- Baseline from the COMPLETED live capture (0_capture.sql; README.md §1b):
--   public.quotes = 60 columns, 13 rows.
--   quotes_scoped() = exactly 60 output columns; positions 57–60 are
--     geographic_scope, geographic_scope_other_detail, pricing_schedule,
--     pricing_schedule_other_detail.
--   quotes_scoped(): SECURITY DEFINER, STABLE, sql, owner postgres,
--     search_path = public; EXECUTE for authenticated observed.
--   Five non-internal triggers on public.quotes.
--
-- Part A is static/catalog only. Part B REQUIRES REAL AUTHENTICATED SESSIONS
-- and cannot be satisfied statically or by running as postgres.

-- =====================================================================
-- PART A — STATIC / CATALOG CHECKS (no session role required)
-- =====================================================================

\echo '=== A0. Column count moved from 60 to the expected post-Q3.4 count ==='
SELECT count(*) AS quotes_column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes';
-- EXPECT: 60 + (number of approved Q3.4 columns; 1 or 2 pending decision D1).

\echo '=== A1. Q3.4 columns: type, nullability, NO default ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('billing_preference','billing_preference_other_detail')
ORDER BY ordinal_position;
-- EXPECT: text / YES / null for each approved column.

\echo '=== A2. All 13 captured rows remain NULL; row count unchanged ==='
SELECT count(*) AS total,
       count(*) FILTER (WHERE billing_preference IS NULL)              AS pref_null,
       count(*) FILTER (WHERE billing_preference_other_detail IS NULL) AS detail_null
FROM public.quotes;
-- EXPECT: total = 13 (captured baseline; higher only if rows were created
--         through normal application use since capture), and
--         pref_null = detail_null = total. Nullable columns with no default
--         and no backfill must leave every pre-existing row NULL.

\echo '=== A3. Constraints present and VALIDATED ==='
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_billing_preference_check',
                  'quotes_billing_preference_other_detail_check');
-- EXPECT: one row per approved constraint, convalidated = true.

\echo '=== A4. Invalid option values rejected; approved values accepted ==='
-- Operator note: run inside an explicit transaction that is ROLLED BACK. It
-- must not leave any of the 13 rows modified. Exact values pending D2/D3.
--   UPDATE ... SET billing_preference = '__not_an_option__'  -> check_violation
--   UPDATE ... SET billing_preference = <approved value>     -> succeeds
-- Then ROLLBACK and re-run A2 to confirm all rows are NULL again.

\echo '=== A5. "Other" detail rule — only if decision D7 approved DB enforcement ==='
-- If D7 = Zod only: no database constraint exists for this; the rule is
-- verified by repository tests, not here.
-- If D7 = database enforcement: detail text attached to a non-Other
-- selection must be rejected; a NULL detail alongside Other must still be
-- ACCEPTED, because Q3.4 is optional and autosaved drafts pass through
-- intermediate states.

\echo '=== A6. quotes_scoped() output columns — count, order, append position ==='
SELECT ordinality AS output_position, name AS output_column
FROM pg_proc p, unnest(p.proargnames) WITH ORDINALITY AS t(name, ordinality)
WHERE p.oid = 'public.quotes_scoped()'::regprocedure
ORDER BY ordinality;
-- EXPECT: positions 1–60 byte-identical to the captured baseline, still
--         ending 57 geographic_scope, 58 geographic_scope_other_detail,
--         59 pricing_schedule, 60 pricing_schedule_other_detail; the Q3.4
--         output(s) appear ONLY at position 61 onward. No reordering, no
--         duplicates, no removals.

\echo '=== A6b. Output column count ==='
SELECT array_length(proargnames, 1) AS output_column_count
FROM pg_proc WHERE oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: 60 + (number of approved Q3.4 outputs).

\echo '=== A7. quotes_scoped() security properties unchanged ==='
SELECT p.prosecdef AS is_security_definer, p.provolatile AS volatility,
       p.prolang::regproc AS language, pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS settings
FROM pg_proc p WHERE p.oid = 'public.quotes_scoped()'::regprocedure;
-- EXPECT: true | s | sql | postgres | {search_path=public}

\echo '=== A8. Grants remain least privilege ==='
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('quotes_scoped','current_user_role')
ORDER BY routine_name, grantee;
-- EXPECT: identical to the captured baseline, including EXECUTE for
--         authenticated on quotes_scoped(). NO EXECUTE for anon or PUBLIC.
--         No service_role grant introduced.

\echo '=== A9. Full definition for diffing against the captured baseline ==='
SELECT pg_get_functiondef('public.quotes_scoped()'::regprocedure);
-- EXPECT: differs from the captured pre-change definition ONLY by the
--         appended Q3.4 output(s) and masking expression(s).

\echo '=== S2-1. Section 1 / Section 2 columns present and unchanged ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('opportunity_stage','deal_priority','deal_template',
                      'quote_validity_date','geographic_scope',
                      'geographic_scope_other_detail','pricing_schedule',
                      'pricing_schedule_other_detail')
ORDER BY column_name;

\echo '=== S2-2. Section 2 constraints still present and validated ==='
SELECT conname, convalidated FROM pg_constraint
WHERE conrelid = 'public.quotes'::regclass
  AND conname IN ('quotes_geographic_scope_check','quotes_pricing_schedule_check');
-- EXPECT: present, convalidated = true (matches captured state).

\echo '=== S2-3. Section 2 authorization trigger present on INSERT and UPDATE ==='
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'quotes_enforce_pricing_schedule_authorization'
ORDER BY event_manipulation;
-- EXPECT: two rows, BEFORE INSERT and BEFORE UPDATE.

\echo '=== S2-3b. Section 2 trigger function body unchanged ==='
SELECT md5(prosrc) AS body_hash
FROM pg_proc
WHERE oid = 'public.enforce_pricing_schedule_authorization()'::regprocedure;
-- EXPECT: identical to the pre-change capture hash. Required whether or not
--         decision D6 chooses to extend an existing trigger — Section 2
--         behaviour must be unchanged either way.

\echo '=== S2-4. All five captured triggers still present ==='
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.quotes'::regclass AND NOT tgisinternal
ORDER BY tgname;
-- EXPECT: enforce_quote_state, notify_quote_reassignment,
--         notify_quote_state_change,
--         quotes_enforce_pricing_schedule_authorization, quotes_updated_at
--         (plus any Q3.4 trigger, only if decision D6 approved one).

\echo '=== S2-5. quotes RLS policies unchanged ==='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotes'
ORDER BY policyname;
-- EXPECT: identical to the captured baseline, including the External
--         draft-update path, the Sales Representative owned-quote update
--         path, and the Estimator/Admin update paths.

\echo '=== S2-6. Lead-conversion RPCs untouched (signatures only) ==='
SELECT p.oid::regprocedure FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('convert_lead_to_quote','claim_and_convert_lead','estimator_assign_and_convert');

\echo '=== S2-7. No Ballpark / public-intake database behaviour changed ==='
SELECT count(*) AS ballpark_rows,
       count(*) FILTER (WHERE billing_preference IS NOT NULL) AS ballpark_with_billing
FROM public.quotes WHERE tier = 'ballpark';
-- EXPECT: ballpark_with_billing = 0.
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name ILIKE '%billing%';
-- EXPECT: zero rows — public intake writes to public.leads, untouched here.

-- =====================================================================
-- PART B — AUTHENTICATED-SESSION CHECKS
-- REQUIRES REAL SESSIONS. Cannot be satisfied statically, and cannot be run
-- as postgres (auth.uid() IS NULL is the trusted context and bypasses the
-- masking semantics under test). Record the actual observed output per role.
-- Expected outcomes for B3, B6 and B7 depend on unresolved decisions
-- D4 (Sales Representative read/write timing) and D5 (External-user write
-- protection); do not record a pass until those are approved.
-- =====================================================================

-- B1.  ESTIMATOR session: SELECT the Q3.4 column(s) FROM public.quotes_scoped()
--      — real values returned.
-- B2.  ADMIN session: same as B1.
-- B3.  SALES_REP session: values returned per the approved D4 timing rule
--      (unconditional, or gated on quote state).
-- B4.  EXTERNAL session: Q3.4 column(s) return NULL for every row.
-- B5.  EXTERNAL session via PostgREST: the raw network response contains no
--      billing values and the external projection never requests them.
-- B6.  WRITE as sales_rep / estimator / admin: setting each approved option
--      value succeeds on a quote they may edit, per D4.
-- B7.  WRITE as external on their own DRAFT row: the live capture shows an
--      External draft-update RLS path, so this must be tested explicitly
--      rather than assumed blocked. Record the actual result and reconcile
--      it with decision D5.
-- B8.  anon / public: no insert or update path to public.quotes at all.
-- B9.  Lead conversion in a real session: converted quotes are created with
--      the Q3.4 column(s) NULL, and conversion succeeds unchanged.
-- B10. Ballpark end-to-end in a real session: unchanged behaviour, no Q3.4
--      field rendered, totals identical to the pre-change run.
-- B11. Section 2 regression in a real session: pricing_schedule remains
--      estimator/admin-write-only and pricing_schedule_other_detail remains
--      estimator/admin-read-only.
