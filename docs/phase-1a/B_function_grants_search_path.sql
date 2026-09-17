-- =====================================================================
-- Phase 1A / Migration B — SECURITY DEFINER function EXECUTE grants and
-- fixed search_path.
--
-- STATUS: PREPARED, NOT APPLIED. For DBA review and execution.
--
-- EVIDENCE BASIS
--   Confirmed from repository evidence — these functions are called from
--   the browser with the `authenticated` role, so they MUST keep EXECUTE
--   for `authenticated`:
--     public.quotes_scoped()                 src/features/intake/useQuote.ts:42 (+7 more call sites)
--     public.quote_versions_scoped()         src/features/intake/useQuoteVersions.ts:29
--     public.transition_quote(uuid, text)    src/features/intake/useQuoteTransition.ts:147,
--                                            src/features/intake/useSubmitQuote.ts:33
--     public.convert_lead_to_quote(uuid)     src/features/leads/useConvertLeadToQuote.ts:18
--     public.claim_and_convert_lead(uuid)    src/features/leads/useLeadActions.ts:34
--     public.estimator_assign_and_convert(uuid, uuid)
--                                            src/features/leads/useLeadActions.ts:70
--   Confirmed: NO repository code calls any of these as `anon`. The only
--   anonymous database operation in the product is a direct INSERT into
--   public.lead_intakes (src/routes/get-a-quote.tsx:88) followed by a
--   SELECT of lead_number on that row (line 118). Migration B therefore
--   revokes anon EXECUTE on every RPC without touching lead intake.
--   Confirmed: private.has_role already has SET search_path = public and
--   correct grants (supabase/migrations/20260820193207_*.sql).
--   Confirmed: public.has_role was DROPPED in that migration.
--   Expected but unverified:
--     * Exact argument types of transition_quote's second parameter. The
--       generated types describe it as the quotes.state value; it is
--       written below as `text` and ALSO attempted as the enum name
--       `public.quote_state`. Both attempts are guarded by
--       to_regprocedure, so the non-existent one is a no-op. DBA MUST
--       confirm from section 3 of VERIFY_phase_1a.sql which one exists.
--     * Whether _convert_lead_core(...) exists (referenced in project
--       notes, never in repository SQL) and its signature. PLACEHOLDER
--       block at the end — DBA to fill in after running the verification
--       query.
--   Unknown (no direct database access): current search_path setting and
--   current EXECUTE grants on every function below.
--
-- WHY search_path MATTERS: a SECURITY DEFINER function without a fixed
-- search_path can be hijacked by a caller-controlled schema. Every
-- function below is set to `public` (plus `private` where the body is
-- expected to call private.has_role), matching the convention already used
-- by private.has_role and public.handle_new_user.
--
-- DESTRUCTIVE OPERATIONS: none. Function bodies are NOT redefined; only
-- their configuration and privileges change.
-- =====================================================================

BEGIN;

DO $phase1a$
DECLARE
  sig   text;
  sigs  text[] := ARRAY[
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
    -- to_regprocedure returns NULL instead of erroring when the function
    -- does not exist, which makes this block safe and idempotent.
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, private', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
      RAISE NOTICE 'Phase 1A/B: hardened %', sig;
    ELSE
      RAISE WARNING 'Phase 1A/B: SKIPPED (not found) %  -- verify manually', sig;
    END IF;
  END LOOP;
END
$phase1a$;

-- Trigger-only functions must never be callable over the Data API. These
-- REVOKEs were already issued for the first two in
-- supabase/migrations/20260818164257_*.sql; repeated here for idempotency
-- and extended to the trigger functions described in docs/*.sql.
DO $phase1a_triggers$
DECLARE
  sig  text;
  sigs text[] := ARRAY[
    'public.handle_new_user()',
    'public.update_updated_at_column()',
    'public.prevent_self_role_change()',        -- docs/ADMIN_USER_MANAGEMENT.sql
    'public.prevent_role_self_escalation()',    -- docs/SECURITY_HARDENING.sql
    'public.force_external_role_on_insert()'    -- docs/SECURITY_HARDENING.sql
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, private', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      RAISE NOTICE 'Phase 1A/B: locked trigger function %', sig;
    ELSE
      RAISE WARNING 'Phase 1A/B: SKIPPED (not found) %', sig;
    END IF;
  END LOOP;
END
$phase1a_triggers$;

-- current_user_role(): referenced by the quotes RLS policies in
-- docs/SESSION_5B_PERMISSIONS.sql. Used only inside policies, never called
-- by the client — repository grep shows no .rpc("current_user_role").
DO $phase1a_role_fn$
BEGIN
  IF to_regprocedure('public.current_user_role()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.current_user_role() SET search_path = public, private';
    EXECUTE 'REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon';
    -- Kept executable by authenticated: policy evaluation runs as the
    -- calling role, and revoking it here can break every quotes policy.
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role';
  ELSE
    RAISE WARNING 'Phase 1A/B: public.current_user_role() not found -- confirm which predicate the quotes policies use';
  END IF;
END
$phase1a_role_fn$;

COMMIT;

-- ---------------------------------------------------------------------
-- PLACEHOLDER — REQUIRES DBA INPUT BEFORE USE
-- Project notes describe a shared conversion core, _convert_lead_core(...),
-- extracted from convert_lead_to_quote / estimator_assign_and_convert /
-- claim_and_convert_lead. It appears in NO repository SQL file and its
-- schema, name and signature cannot be confirmed here. If section 3 of
-- VERIFY_phase_1a.sql shows it, apply the same treatment, and revoke
-- EXECUTE from authenticated as well — it is an internal helper and
-- should only be reachable from the three wrapper RPCs:
--
--   ALTER FUNCTION <schema>._convert_lead_core(<args>) SET search_path = public, private;
--   REVOKE ALL ON FUNCTION <schema>._convert_lead_core(<args>) FROM PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION <schema>._convert_lead_core(<args>) TO service_role;
--
-- CAUTION: if the wrappers are SECURITY DEFINER owned by the same role,
-- revoking `authenticated` is safe. If any wrapper is SECURITY INVOKER,
-- revoking breaks lead conversion. Confirm proconfig/prosecdef first.
-- ---------------------------------------------------------------------

-- =====================================================================
-- ROLLBACK GUIDANCE
--   Capture the pre-state first (VERIFY_phase_1a.sql sections 3-6). Then:
--     ALTER FUNCTION <sig> RESET search_path;           -- or SET to prior value
--     GRANT EXECUTE ON FUNCTION <sig> TO <prior grantees>;
--   Nothing here drops or redefines a function, so rollback is limited to
--   restoring configuration and privileges.
-- =====================================================================
