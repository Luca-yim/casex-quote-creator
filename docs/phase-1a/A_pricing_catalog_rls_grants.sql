-- =====================================================================
-- Phase 1A / Migration A (REVISED, minimal) — public.pricing_catalog only.
--
-- STATUS: PREPARED, NOT APPLIED, NOT VERIFIED. For external DBA execution.
-- Revised 2026-09-18 to the minimal set of fixes identified by the live
-- read-only audit. The previous revision also touched
-- ballpark_sizing_reference, rate_cards and phase_weight_allocation; those
-- tables are now DELIBERATELY OUT OF SCOPE — see the "explicitly excluded"
-- note at the bottom.
--
-- SCOPE OF THIS FILE
--   1. Enable RLS on public.pricing_catalog.
--   2. Revoke all anon access.
--   3. Remove DELETE from authenticated (no application delete path).
--   4. Preserve SELECT for authenticated (TEMPORARY — see note).
--   5. Restrict INSERT and UPDATE to admins via RLS.
--
-- EVIDENCE BASIS (repository only; no database inspection was performed)
--   * pricing_catalog is read by the browser as `authenticated`:
--       src/hooks/usePricingCatalog.ts:18
--       src/features/pdf-export/useQuotePdfDownload.ts:88
--   * No repository code performs insert/update/delete/upsert on
--     pricing_catalog. Catalog writes today are out-of-band.
--   * src/test/db/rls.test.ts:40-54 asserts authenticated users can read
--     pricing_catalog and anonymous callers cannot.
--   * private.has_role is the current role predicate
--     (supabase/migrations/20260820193207_*.sql). public.has_role was
--     DROPPED there — do not reference it.
--
-- TEMPORARY DECISION — authenticated SELECT stays open
--   Narrowing catalog reads by role would break the external dashboard and
--   the PDF path, which need SKU labels and tier ranges. Column-level
--   confidentiality is currently enforced in the application projection
--   (src/lib/quote-columns.ts, src/hooks/usePricingCatalog.ts). This is an
--   application-layer control, NOT a database control, and is carried
--   forward as an open item for a later phase.
--
-- DESTRUCTIVE OPERATIONS: none. No row data is read, written or deleted.
-- =====================================================================

BEGIN;

ALTER TABLE public.pricing_catalog ENABLE ROW LEVEL SECURITY;

-- 2. anon must hold nothing. Safe if it already holds nothing.
REVOKE ALL ON public.pricing_catalog FROM anon;

-- 3. + 4. Remove DELETE, keep the read the application depends on, and keep
-- INSERT/UPDATE privileges only so the admin-gated policies below can take
-- effect. Every write row is still checked by private.has_role(...,'admin').
REVOKE DELETE ON public.pricing_catalog FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pricing_catalog TO authenticated;

-- service_role: NOT granted here. No repository evidence proves a
-- service_role write path to this table exists. If live verification shows
-- an out-of-band admin/ETL job using the service key, add the grant then.

DROP POLICY IF EXISTS "pricing_catalog_read_authenticated" ON public.pricing_catalog;
CREATE POLICY "pricing_catalog_read_authenticated"
  ON public.pricing_catalog FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pricing_catalog_admin_insert" ON public.pricing_catalog;
CREATE POLICY "pricing_catalog_admin_insert"
  ON public.pricing_catalog FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "pricing_catalog_admin_update" ON public.pricing_catalog;
CREATE POLICY "pricing_catalog_admin_update"
  ON public.pricing_catalog FOR UPDATE TO authenticated
  USING      (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- No DELETE policy: catalog rows are retired via expiration_date.

COMMIT;

-- =====================================================================
-- EXPLICITLY EXCLUDED FROM THIS MIGRATION (do not re-add in Phase 1A)
--   public.ballpark_sizing_reference   — leave current access as-is.
--   public.phase_weight_allocation     — leave current access as-is.
--   public.rate_cards                  — PRESERVE existing Estimator/Admin
--                                        -only access. Do not broaden to
--                                        sales_rep in this phase.
--   public.quote_wbs_lines             — PRESERVE existing Estimator/Admin
--   public.quote_cost_items              -only access. Not touched here.
-- Their read/write behaviour is recorded for verification in
-- ROLE_VERIFICATION_PLAN.md and VERIFY_phase_1a.sql, not changed.
-- =====================================================================

-- =====================================================================
-- ROLLBACK GUIDANCE (run inside a transaction; capture the pre-state with
-- VERIFY_phase_1a.sql sections 1, 2 and 2b BEFORE applying)
--
-- BEGIN;
--   DROP POLICY IF EXISTS "pricing_catalog_read_authenticated" ON public.pricing_catalog;
--   DROP POLICY IF EXISTS "pricing_catalog_admin_insert"       ON public.pricing_catalog;
--   DROP POLICY IF EXISTS "pricing_catalog_admin_update"       ON public.pricing_catalog;
--   -- Only if RLS was OFF before this migration:
--   -- ALTER TABLE public.pricing_catalog DISABLE ROW LEVEL SECURITY;
--   -- Restore exactly the grants captured in the pre-state run, e.g.
--   -- GRANT DELETE ON public.pricing_catalog TO authenticated;
--   -- GRANT SELECT ON public.pricing_catalog TO anon;
-- COMMIT;
-- =====================================================================
