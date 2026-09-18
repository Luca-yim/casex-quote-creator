-- =====================================================================
-- Phase 1A / Migration B (REVISED, minimal) — function EXECUTE grants and
-- one targeted search_path fix.
--
-- STATUS: PREPARED, NOT APPLIED, NOT VERIFIED. For external DBA execution.
-- Revised 2026-09-18. The previous revision reset search_path on EVERY
-- listed function and granted service_role broadly. Both were removed:
-- search_path is now changed on handle_new_user() ONLY, and service_role is
-- granted nowhere, because no repository or live evidence proves it is
-- required.
--
-- SCOPE OF THIS FILE
--   1. Keep authenticated EXECUTE on the six client-called RPCs.
--   2. Revoke PUBLIC / anon EXECUTE from those RPCs.
--   3. Revoke anon AND authenticated EXECUTE from public._convert_lead_core(...).
--   4. Revoke API (PUBLIC/anon/authenticated) EXECUTE from trigger-only functions.
--   5. Add an explicit safe search_path to public.handle_new_user().
--
-- EVIDENCE BASIS (repository only; no database inspection was performed)
--   Called from the browser as `authenticated` — MUST keep EXECUTE:
--     public.quotes_scoped()                 src/features/intake/useQuote.ts:42 (+7 sites)
--     public.quote_versions_scoped()         src/features/intake/useQuoteVersions.ts:29
--     public.transition_quote(...)           src/features/intake/useQuoteTransition.ts:147
--                                            src/features/intake/useSubmitQuote.ts:33
--     public.convert_lead_to_quote(uuid)     src/features/leads/useConvertLeadToQuote.ts:18
--     public.claim_and_convert_lead(uuid)    src/features/leads/useLeadActions.ts:34
--     public.estimator_assign_and_convert(uuid, uuid)
--                                            src/features/leads/useLeadActions.ts:70
--   No repository code calls any RPC as an unauthenticated caller. The only
--   anonymous-path database operation is a direct INSERT into
--   public.lead_intakes (src/routes/get-a-quote.tsx:88) plus a SELECT of
--   lead_number on that row (line 118). Nothing here touches either.
--   NOTE ON IDENTITY: the public intake caller holds a Supabase anonymous
--   Auth JWT, which Postgres may present as `authenticated` (see
--   ROLE_VERIFICATION_PLAN.md). Confirm this in staging before relying on
--   any anon-only revoke as a control over that flow.
--
-- CRITICAL PRECONDITION FOR CHANGE 3
--   Revoking EXECUTE from `authenticated` on _convert_lead_core is safe
--   ONLY IF every wrapper (convert_lead_to_quote, claim_and_convert_lead,
--   estimator_assign_and_convert) is SECURITY DEFINER and owned by a role
--   that retains EXECUTE on the core. Under SECURITY DEFINER the nested
--   call is privilege-checked as the function owner, not the caller.
--   If ANY wrapper is SECURITY INVOKER, this revoke BREAKS lead conversion.
--   VERIFY FIRST: VERIFY_phase_1a.sql sections 3 and 6b (prosecdef, owner,
--   has_function_privilege). The block below refuses to run unless all
--   three wrappers report prosecdef = true.
--
-- DESTRUCTIVE OPERATIONS: none. No function body is redefined.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. + 2. Client-called RPCs: authenticated only. search_path untouched.
-- ---------------------------------------------------------------------
DO $phase1a_rpcs$
DECLARE
  sig  text;
  sigs text[] := ARRAY[
    'public.quotes_scoped()',
    'public.quote_versions_scoped()',
    'public.transition_quote(uuid, text)',
    'public.transition_quote(uuid, public.quote_state)',
    'public.convert_lead_to_quote(uuid)',
    'public.claim_and_convert_lead(uuid)',
    'public.estimator_assign_and_convert(uuid, uuid)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    -- to_regprocedure returns NULL rather than erroring for a missing
    -- function, so the two transition_quote spellings are self-selecting.
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
      RAISE NOTICE 'Phase 1A/B: scoped EXECUTE to authenticated on %', sig;
    ELSE
      RAISE WARNING 'Phase 1A/B: SKIPPED (not found) %  -- verify manually', sig;
    END IF;
  END LOOP;
END
$phase1a_rpcs$;

-- ---------------------------------------------------------------------
-- 3. Internal conversion core: not part of the public API surface.
--    Guarded by the SECURITY DEFINER precondition described above.
-- ---------------------------------------------------------------------
DO $phase1a_core$
DECLARE
  core_oid   oid;
  bad_wrapper text;
BEGIN
  SELECT p.oid INTO core_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_convert_lead_core'
  LIMIT 1;

  IF core_oid IS NULL THEN
    RAISE WARNING 'Phase 1A/B: public._convert_lead_core(...) not found -- confirm its real schema/name before assuming it is absent';
    RETURN;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO bad_wrapper
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('convert_lead_to_quote','claim_and_convert_lead','estimator_assign_and_convert')
    AND NOT p.prosecdef;

  IF bad_wrapper IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 1A/B ABORT: wrapper(s) % are SECURITY INVOKER; revoking EXECUTE on _convert_lead_core would break lead conversion', bad_wrapper;
  END IF;

  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', core_oid::regprocedure);
  RAISE NOTICE 'Phase 1A/B: revoked API EXECUTE on %', core_oid::regprocedure;
END
$phase1a_core$;

-- ---------------------------------------------------------------------
-- 4. Trigger-only functions must not be callable over the Data API.
--    Trigger execution does not require EXECUTE by the calling role —
--    revoking API EXECUTE from public.enforce_quote_state_transition()
--    does NOT remove trigger execution; the trigger on public.quotes
--    keeps firing. This must still be verified in staging by exercising
--    valid and invalid quote transitions after applying (see
--    ROLE_VERIFICATION_PLAN.md rows 17-18, 23).
--    NOTE (verified 2026-09-18): enforce_quote_state_transition() is
--    SECURITY DEFINER with search_path 'public' and calls
--    public.current_user_role(). Its search_path is deliberately NOT
--    altered here — do not change it unless a separate security review
--    identifies a concrete issue. public.current_user_role() keeps its
--    EXECUTE grants untouched (it is evaluated inside the quotes RLS
--    policies; revoking it would break every quote read).
--    search_path is NOT altered here (see change 5 for the one exception).
-- ---------------------------------------------------------------------
DO $phase1a_triggers$
DECLARE
  sig  text;
  sigs text[] := ARRAY[
    'public.handle_new_user()',
    'public.update_updated_at_column()',
    'public.enforce_quote_state_transition()',
    'public.prevent_self_role_change()',        -- docs/ADMIN_USER_MANAGEMENT.sql
    'public.prevent_role_self_escalation()',    -- docs/SECURITY_HARDENING.sql
    'public.force_external_role_on_insert()'    -- docs/SECURITY_HARDENING.sql
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      RAISE NOTICE 'Phase 1A/B: removed API EXECUTE from trigger function %', sig;
    ELSE
      RAISE WARNING 'Phase 1A/B: SKIPPED (not found) %', sig;
    END IF;
  END LOOP;
END
$phase1a_triggers$;

-- ---------------------------------------------------------------------
-- 5. handle_new_user() is SECURITY DEFINER and runs on auth.users INSERT.
--    Its current setting is search_path = 'public' only; that resolves the
--    two writes it performs but leaves any unqualified helper lookup open.
--    Pin it explicitly and drop the implicit reliance on a mutable path.
--    This is the ONLY search_path change in Phase 1A. Every other
--    function's search_path is left exactly as found and is reported for
--    review by VERIFY_phase_1a.sql sections 3 and 4.
-- ---------------------------------------------------------------------
DO $phase1a_hnu$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp';
  ELSE
    RAISE WARNING 'Phase 1A/B: public.handle_new_user() not found';
  END IF;
END
$phase1a_hnu$;

COMMIT;

-- =====================================================================
-- NOT DONE HERE — DELIBERATELY
--   * No service_role grant on any function.
--   * No blanket search_path rewrite. If section 4 of the verification
--     script reports other SECURITY DEFINER functions without a fixed
--     search_path, list them for DBA review; do not batch-fix them under
--     Phase 1A.
--   * public.current_user_role(): left untouched. It is evaluated inside
--     the quotes RLS policies (docs/SESSION_5B_PERMISSIONS.sql) and a
--     mistaken revoke there breaks every quote read. Report its grants.
--
-- ROLLBACK GUIDANCE
--   Capture the pre-state first (VERIFY_phase_1a.sql sections 3, 6, 6b).
--     GRANT EXECUTE ON FUNCTION <sig> TO <prior grantees>;
--     ALTER FUNCTION public.handle_new_user() SET search_path = public;
--   Nothing here drops or redefines a function; rollback restores
--   privileges and that one configuration value only.
-- =====================================================================
