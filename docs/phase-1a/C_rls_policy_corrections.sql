-- =====================================================================
-- Phase 1A / Migration C — overly broad public-role RLS policies, and
-- RLS-enabled tables with no policies.
--
-- STATUS: PREPARED, NOT APPLIED. For DBA review and execution.
-- This migration is DELIBERATELY the most conservative of the four:
-- several findings below are INVESTIGATION ITEMS, not changes, because the
-- current policy set cannot be read from this workspace.
--
-- EVIDENCE BASIS
--   Confirmed from repository evidence:
--     * Every policy created in supabase/migrations/* names `TO
--       authenticated` explicitly. Policies created later via the SQL
--       editor (docs/*.sql) also name `TO authenticated`, EXCEPT the
--       policies on public.quotes described in
--       docs/SESSION_5B_PERMISSIONS.sql, which are `TO authenticated` too.
--       So no repository-visible policy targets the PUBLIC role. Any
--       PUBLIC-role policy found by section 7 of VERIFY_phase_1a.sql was
--       created outside the repository and needs case-by-case review.
--     * Tables known to the application (src/lib/database.types.ts):
--         past_deployments, pricing_catalog, pricing_reviews, profiles,
--         quote_comments, quote_versions, quotes, vertical_labels,
--         vertical_solutions, ballpark_sizing_reference, quote_wbs_lines,
--         quote_cost_items, rate_cards, phase_weight_allocation,
--         lead_intakes, notifications, quote_pdfs.
--     * Of these, the repository contains policy SQL for only: profiles,
--       user_roles, quotes, quote_pdfs. Everything else is UNKNOWN.
--     * public.lead_intakes MUST stay insertable by `anon`
--       (src/routes/get-a-quote.tsx:88) and the inserting session must be
--       able to read back `lead_number` on its own row (line 118).
--       Nothing in this migration touches lead_intakes.
--     * src/features/leads/useLeadQueue.ts:73 reads lead_intakes directly
--       (base table, not an RPC) and joins profiles twice; internal roles
--       must keep that read.
--   Expected but unverified: the existing policy names on quotes,
--   quote_versions, notifications, quote_wbs_lines, quote_cost_items.
--   Unknown: which tables currently have RLS on with zero policies.
--
-- DESTRUCTIVE OPERATIONS: none. No DROP POLICY on a policy this file did
-- not create; no data changes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Reference/lookup tables read by the client with no repository policy
--    evidence. Enabling RLS with an explicit authenticated-read policy is
--    additive: it cannot remove access the app has today, because the app
--    only ever reads them as `authenticated`.
--      src/hooks/useVerticalLabels.ts:15     vertical_labels
--      src/hooks/useVerticalSolutions.ts:12  vertical_solutions
--    ASSUMPTION REQUIRING VERIFICATION: vertical_labels / vertical_solutions
--    are NOT read anonymously. The public intake form at
--    src/routes/get-a-quote.tsx establishes an anonymous Supabase session
--    BEFORE the form renders, and those hooks are gated behind
--    `enabled: !disabled` for exactly that reason — so the reader is an
--    anonymous-but-authenticated JWT, which Postgres sees as the `anon`
--    role. THE READ POLICIES BELOW THEREFORE INCLUDE anon. Removing anon
--    here WILL break the public lead-intake vertical/solution pickers.
-- ---------------------------------------------------------------------
ALTER TABLE public.vertical_labels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_solutions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.vertical_labels    TO anon, authenticated;
GRANT SELECT ON public.vertical_solutions TO anon, authenticated;
GRANT ALL    ON public.vertical_labels    TO service_role;
GRANT ALL    ON public.vertical_solutions TO service_role;

DROP POLICY IF EXISTS "vertical_labels_read" ON public.vertical_labels;
CREATE POLICY "vertical_labels_read"
  ON public.vertical_labels FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "vertical_solutions_read" ON public.vertical_solutions;
CREATE POLICY "vertical_solutions_read"
  ON public.vertical_solutions FOR SELECT TO anon, authenticated
  USING (true);

-- Writes on lookup tables: admin only, no DELETE grant.
GRANT INSERT, UPDATE ON public.vertical_labels    TO authenticated;
GRANT INSERT, UPDATE ON public.vertical_solutions TO authenticated;

DROP POLICY IF EXISTS "vertical_labels_admin_write" ON public.vertical_labels;
CREATE POLICY "vertical_labels_admin_write"
  ON public.vertical_labels FOR ALL TO authenticated
  USING      (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "vertical_solutions_admin_write" ON public.vertical_solutions;
CREATE POLICY "vertical_solutions_admin_write"
  ON public.vertical_solutions FOR ALL TO authenticated
  USING      (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------
-- 2. Deny-by-default hardening for tables the client NEVER touches
--    directly. Repository grep confirms no .from("past_deployments") and
--    no .from("pricing_reviews") anywhere in src/ or e2e/. Enabling RLS
--    with no permissive policy leaves them reachable only by service_role
--    and by SECURITY DEFINER functions.
--    RISK: if an unlisted internal tool reads these with a user JWT, it
--    will start returning zero rows. DBA to confirm before applying.
-- ---------------------------------------------------------------------
ALTER TABLE public.past_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_reviews  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.past_deployments FROM anon;
REVOKE ALL ON public.pricing_reviews  FROM anon;
GRANT  ALL ON public.past_deployments TO service_role;
GRANT  ALL ON public.pricing_reviews  TO service_role;

COMMENT ON TABLE public.past_deployments IS
  'Phase 1A: RLS enabled, intentionally no permissive policy. Reachable only via service_role / SECURITY DEFINER. No client read path exists as of 2026-09-17.';
COMMENT ON TABLE public.pricing_reviews IS
  'Phase 1A: RLS enabled, intentionally no permissive policy. Reachable only via service_role / SECURITY DEFINER. No client read path exists as of 2026-09-17.';

COMMIT;

-- =====================================================================
-- INVESTIGATION ITEMS — NO SQL WRITTEN, DBA ACTION REQUIRED
--
-- I-1  quote_wbs_lines / quote_cost_items
--      Read and written from the browser (src/features/wbs/useWbsData.ts).
--      No policy SQL exists anywhere in the repository for either table.
--      If RLS is OFF, every authenticated user can read and edit every
--      quote's WBS and cost lines, including cost rates. This is the
--      highest-severity open item in Phase 1A. Correct policies depend on
--      the ownership columns on those tables and on the quotes policy set,
--      neither of which can be read here — so no SQL is proposed.
--      Run VERIFY_phase_1a.sql sections 1, 2 and 7 for these two tables
--      first, then prepare a follow-up migration.
--
-- I-2  PUBLIC-role policies
--      Section 7 lists any policy whose roles include `public` (i.e. `TO
--      PUBLIC`, which covers anon). Review each. Repository evidence
--      predicts ONE legitimate anon path only: INSERT on lead_intakes plus
--      a self-scoped SELECT of that row. Anything else granting anon
--      access to quotes, pricing, WBS or profiles is a finding.
--
-- I-3  RLS-enabled tables with zero policies
--      Section 8 lists them. For each, decide: intentional deny-by-default
--      (like item 2 above), or an accidental lockout. Cross-check against
--      the client read paths in the Phase 1A application compatibility
--      report before adding any policy.
--
-- I-4  profiles.role column
--      docs/SECURITY_HARDENING.sql and docs/QUOTE_PDFS_INTERNAL_SCOPE.sql
--      both read `profiles.role`, but the generated types
--      (src/lib/database.types.ts:140) show NO role column on profiles —
--      roles live in public.user_roles. If profiles.role does not exist,
--      the quote_pdfs policies in QUOTE_PDFS_INTERNAL_SCOPE.sql either
--      were never applied or reference a dropped column. CONFLICT:
--      confirm which is true before trusting the internal-PDF boundary.
--
-- I-5  docs/*.sql drift
--      docs/DRAFT_DELETE.sql, docs/QUOTE_PDFS_INTERNAL_SCOPE.sql and
--      docs/ADMIN_USER_MANAGEMENT.sql all call public.has_role(...), which
--      was DROPPED in supabase/migrations/20260820193207_*.sql in favour of
--      private.has_role. Any policy still carrying that expression will
--      error at evaluation time. Section 7 output shows the live
--      expressions — grep it for `has_role` and check the schema prefix.
-- =====================================================================

-- =====================================================================
-- ROLLBACK GUIDANCE
-- BEGIN;
--   DROP POLICY IF EXISTS "vertical_labels_read"          ON public.vertical_labels;
--   DROP POLICY IF EXISTS "vertical_labels_admin_write"   ON public.vertical_labels;
--   DROP POLICY IF EXISTS "vertical_solutions_read"       ON public.vertical_solutions;
--   DROP POLICY IF EXISTS "vertical_solutions_admin_write" ON public.vertical_solutions;
--   -- Only if RLS was OFF beforehand (capture pre-state first):
--   -- ALTER TABLE public.vertical_labels    DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.vertical_solutions DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.past_deployments   DISABLE ROW LEVEL SECURITY;
--   -- ALTER TABLE public.pricing_reviews    DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- =====================================================================
