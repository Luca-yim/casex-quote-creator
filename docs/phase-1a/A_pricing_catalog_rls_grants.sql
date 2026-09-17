-- =====================================================================
-- Phase 1A / Migration A — public.pricing_catalog (and sibling reference
-- tables) RLS + grants.
--
-- STATUS: PREPARED, NOT APPLIED. For DBA review and execution.
-- Author: application team. Date prepared: 2026-09-17.
--
-- EVIDENCE BASIS
--   Confirmed from repository evidence:
--     * public.pricing_catalog is read by the browser client with the
--       `authenticated` role:
--         src/hooks/usePricingCatalog.ts:18   .from("pricing_catalog").select(...)
--         src/features/pdf-export/useQuotePdfDownload.ts:88
--     * public.ballpark_sizing_reference is read the same way:
--         src/features/estimator-ballpark/useBallparkSizingReference.ts:30
--         src/features/pdf-export/useQuotePdfDownload.ts:114
--     * public.rate_cards and public.phase_weight_allocation are read the
--       same way: src/features/wbs/useWbsData.ts:129,162
--     * NO client code anywhere performs insert/update/delete/upsert on any
--       of these tables (repo-wide grep for .from("<table>") shows reads
--       only). Catalog writes today are out-of-band (SQL editor / service
--       role).
--     * src/test/db/rls.test.ts:40-54 asserts: any authenticated user can
--       read pricing_catalog; anonymous callers must NOT.
--   Expected but unverified:
--     * Current RLS status and existing policy names on these tables.
--     * Current grants held by anon / authenticated / service_role.
--   Unknown (no direct database access):
--     * Whether pricing_catalog.naspo_discount_price exists in the live
--       schema. Application code reads it
--       (src/hooks/usePricingCatalog.ts) but the generated types at
--       src/lib/database.types.ts:50 do NOT list it. See the CONFLICT note
--       in the Phase 1A report. This migration never references that
--       column, so the discrepancy does not affect it.
--
-- DESIGN DECISIONS
--   * Reads stay open to every authenticated user. Column-level
--     confidentiality (hiding unit rates from external users) is enforced
--     in the application projection, src/lib/quote-columns.ts +
--     src/hooks/usePricingCatalog.ts. Narrowing reads by role here WOULD
--     BREAK the external dashboard, which needs SKU labels/tier ranges.
--   * Writes are closed to anon and authenticated entirely. Admin-authorised
--     write paths are added as explicit admin-only policies so that a future
--     admin catalog editor works without another grant change; INSERT/UPDATE
--     privileges are granted to `authenticated` but every row is gated by
--     private.has_role(auth.uid(),'admin'). DELETE is deliberately NOT
--     granted — catalog rows are retired via expiration_date.
--   * private.has_role is the current role predicate
--     (supabase/migrations/20260820193207_*.sql). public.has_role was
--     DROPPED in that same migration; do not reference it.
--
-- DESTRUCTIVE OPERATIONS: none. No row data is read, written, or deleted.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. pricing_catalog
-- ---------------------------------------------------------------------
ALTER TABLE public.pricing_catalog ENABLE ROW LEVEL SECURITY;

-- Revoke anything anon may hold. Safe if it holds nothing.
REVOKE ALL ON public.pricing_catalog FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.pricing_catalog TO authenticated;
GRANT ALL                     ON public.pricing_catalog TO service_role;

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

-- ---------------------------------------------------------------------
-- 2. ballpark_sizing_reference — same shape, same read audience.
-- ---------------------------------------------------------------------
ALTER TABLE public.ballpark_sizing_reference ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ballpark_sizing_reference FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.ballpark_sizing_reference TO authenticated;
GRANT ALL                     ON public.ballpark_sizing_reference TO service_role;

DROP POLICY IF EXISTS "ballpark_sizing_read_authenticated" ON public.ballpark_sizing_reference;
CREATE POLICY "ballpark_sizing_read_authenticated"
  ON public.ballpark_sizing_reference FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ballpark_sizing_admin_write" ON public.ballpark_sizing_reference;
CREATE POLICY "ballpark_sizing_admin_write"
  ON public.ballpark_sizing_reference FOR ALL TO authenticated
  USING      (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------
-- 3. rate_cards — cost rates are internal. Read audience is NARROWER:
--    only estimator/admin surfaces consume it (src/features/wbs/useWbsData.ts,
--    reached from the WBS editor panel). Confirmed from repository
--    evidence: no external/sales-rep-only screen imports useWbsData.
--    ASSUMPTION REQUIRING DBA + PRODUCT CONFIRMATION: if a sales rep is
--    ever expected to open the WBS editor read-only, add 'sales_rep' to the
--    read policy below before applying.
-- ---------------------------------------------------------------------
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_cards FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.rate_cards TO authenticated;
GRANT ALL                     ON public.rate_cards TO service_role;

DROP POLICY IF EXISTS "rate_cards_read_internal" ON public.rate_cards;
CREATE POLICY "rate_cards_read_internal"
  ON public.rate_cards FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'estimator'::public.app_role)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "rate_cards_admin_write" ON public.rate_cards;
CREATE POLICY "rate_cards_admin_write"
  ON public.rate_cards FOR ALL TO authenticated
  USING      (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------
-- 4. phase_weight_allocation — non-sensitive display weights, read by the
--    same WBS panel.
-- ---------------------------------------------------------------------
ALTER TABLE public.phase_weight_allocation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase_weight_allocation FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.phase_weight_allocation TO authenticated;
GRANT ALL                     ON public.phase_weight_allocation TO service_role;

DROP POLICY IF EXISTS "phase_weights_read_authenticated" ON public.phase_weight_allocation;
CREATE POLICY "phase_weights_read_authenticated"
  ON public.phase_weight_allocation FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "phase_weights_admin_write" ON public.phase_weight_allocation;
CREATE POLICY "phase_weights_admin_write"
  ON public.phase_weight_allocation FOR ALL TO authenticated
  USING      (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

COMMIT;

-- =====================================================================
-- ROLLBACK GUIDANCE (run inside a transaction)
--
-- BEGIN;
--   DROP POLICY IF EXISTS "pricing_catalog_read_authenticated" ON public.pricing_catalog;
--   DROP POLICY IF EXISTS "pricing_catalog_admin_insert"       ON public.pricing_catalog;
--   DROP POLICY IF EXISTS "pricing_catalog_admin_update"       ON public.pricing_catalog;
--   DROP POLICY IF EXISTS "ballpark_sizing_read_authenticated" ON public.ballpark_sizing_reference;
--   DROP POLICY IF EXISTS "ballpark_sizing_admin_write"        ON public.ballpark_sizing_reference;
--   DROP POLICY IF EXISTS "rate_cards_read_internal"           ON public.rate_cards;
--   DROP POLICY IF EXISTS "rate_cards_admin_write"             ON public.rate_cards;
--   DROP POLICY IF EXISTS "phase_weights_read_authenticated"   ON public.phase_weight_allocation;
--   DROP POLICY IF EXISTS "phase_weights_admin_write"          ON public.phase_weight_allocation;
--   -- Only if RLS was OFF before this migration (capture the pre-state with
--   -- the query in VERIFY_phase_1a.sql section 1 BEFORE applying):
--   -- ALTER TABLE public.pricing_catalog            DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.ballpark_sizing_reference  DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.rate_cards                 DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.phase_weight_allocation    DISABLE ROW LEVEL SECURITY;
--   -- Restore any pre-existing grants captured in the same pre-state run.
-- COMMIT;
-- =====================================================================
