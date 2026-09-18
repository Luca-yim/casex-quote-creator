-- =====================================================================
-- Phase 1A / Migration C (REVISED, minimal) — public lookup tables only.
--
-- STATUS: PREPARED, NOT APPLIED, NOT VERIFIED. For external DBA execution.
-- Revised 2026-09-18. Everything unrelated to the verified public intake
-- read path was REMOVED from the executable section and demoted to an
-- investigation note:
--   * past_deployments   — no longer modified.
--   * pricing_reviews    — no longer modified.
--   * quote_wbs_lines    — no longer modified; existing Estimator/Admin-only
--   * quote_cost_items     access is PRESERVED as-is.
--   * vertical_labels / vertical_solutions — admin write policies and
--     INSERT/UPDATE grants REMOVED. No application write path exists, so
--     no write grant is issued.
--
-- SCOPE OF THIS FILE
--   Preserve the verified public lookup read behaviour required by the
--   anonymous /get-a-quote flow, with RLS switched on and an explicit
--   read-only policy. Nothing else.
--
-- EVIDENCE BASIS (repository only; no database inspection was performed)
--   * src/hooks/useVerticalLabels.ts:15    reads vertical_labels
--   * src/hooks/useVerticalSolutions.ts:12 reads vertical_solutions
--   * Both hooks are gated behind `enabled: !disabled` and run on the
--     public intake page (src/routes/get-a-quote.tsx) only AFTER an
--     anonymous Supabase session exists.
--   * No repository code writes to either table.
--
-- IDENTITY CAVEAT (must be settled in staging before applying)
--   A Supabase anonymous Auth user presents a JWT and is expected to reach
--   Postgres as `authenticated`, not `anon`. A caller with no JWT at all is
--   `anon`. The read policy below names BOTH roles so the public picker
--   works under either resolution. If staging proves the intake caller is
--   `authenticated`, the `anon` half can be dropped in a later phase —
--   do NOT pre-emptively narrow it here.
--
-- DESTRUCTIVE OPERATIONS: none.
-- =====================================================================

BEGIN;

ALTER TABLE public.vertical_labels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_solutions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.vertical_labels    TO anon, authenticated;
GRANT SELECT ON public.vertical_solutions TO anon, authenticated;

-- No INSERT / UPDATE / DELETE grants: there is no application write path.
-- No service_role grant: not proven necessary by repository or live evidence.

DROP POLICY IF EXISTS "vertical_labels_read" ON public.vertical_labels;
CREATE POLICY "vertical_labels_read"
  ON public.vertical_labels FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "vertical_solutions_read" ON public.vertical_solutions;
CREATE POLICY "vertical_solutions_read"
  ON public.vertical_solutions FOR SELECT TO anon, authenticated
  USING (true);

COMMIT;

-- =====================================================================
-- INVESTIGATION NOTES — NO SQL, NO ACTION IN PHASE 1A
--
-- I-1  quote_wbs_lines / quote_cost_items
--      Read and written from the browser (src/features/wbs/useWbsData.ts).
--      Current behaviour is understood to be Estimator/Admin-only and is
--      PRESERVED unchanged. Confirm it with VERIFY_phase_1a.sql section 8b
--      before proposing any policy work in a later phase. Do not broaden
--      Sales access.
--
-- I-2  past_deployments / pricing_reviews
--      No client read path exists in the repository. Previously proposed
--      deny-by-default RLS was removed from this migration because the
--      live audit did not identify it as a necessary fix. Record their
--      current RLS/grant state from sections 1 and 2; decide later.
--
-- I-3  PUBLIC-role policies
--      Section 7 lists any policy whose roles include `public`. The only
--      legitimate unauthenticated path predicted by the repository is the
--      lead_intakes intake INSERT plus a self-scoped SELECT of that row.
--      Anything else is a finding for review, not a Phase 1A change.
--
-- I-4  profiles.role
--      docs/SECURITY_HARDENING.sql and docs/QUOTE_PDFS_INTERNAL_SCOPE.sql
--      read `profiles.role`, but the generated types
--      (src/lib/database.types.ts:140) show no such column — roles live in
--      public.user_roles. Section 10 of the verification script resolves
--      this. CONFLICT: unresolved.
--
-- I-5  docs/*.sql drift
--      docs/DRAFT_DELETE.sql, docs/QUOTE_PDFS_INTERNAL_SCOPE.sql and
--      docs/ADMIN_USER_MANAGEMENT.sql call public.has_role(...), dropped in
--      supabase/migrations/20260820193207_*.sql in favour of
--      private.has_role. Grep section 7 output for `has_role` and check the
--      schema prefix on every live policy expression.
--
-- ROLLBACK GUIDANCE
-- BEGIN;
--   DROP POLICY IF EXISTS "vertical_labels_read"    ON public.vertical_labels;
--   DROP POLICY IF EXISTS "vertical_solutions_read" ON public.vertical_solutions;
--   -- Only if RLS was OFF beforehand (capture pre-state first):
--   -- ALTER TABLE public.vertical_labels    DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.vertical_solutions DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- =====================================================================
