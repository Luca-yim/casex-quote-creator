-- =====================================================================
-- Section 3 / Q3.4 (Billing Preference) — ROLLBACK **DRAFT**
-- =====================================================================
-- STATUS: DRAFT. **NOT EXECUTABLE.** NOT APPROVED. NOT APPLIED.
--
-- Live capture status: COMPLETE (see 0_capture.sql and README.md §1b).
-- The captured pre-change quotes_scoped() definition — 60 output columns,
-- SECURITY DEFINER, STABLE, SQL language, owner postgres,
-- search_path = public — is the authoritative rollback baseline.
--
-- WARNING — PRESERVE THE PRE-CHANGE CAPTURE.
--   The verbatim pre-change function body is held in the operator's capture
--   output and is deliberately NOT reproduced in this repository. Paste it
--   into §1 at execution time. If that capture is lost, DO NOT RUN THIS
--   FILE: reconstructing the body from repository files would silently
--   discard live drift and Section 1 / Section 2 / Q3.1a / Q3.2 behaviour.
--
-- This rollback removes ONLY Q3.4 objects. It must not touch Section 1,
-- Section 2, Q3.1a, Q3.2, the Section 2 authorization trigger, the other
-- four live triggers, the quotes RLS policies, pricing objects, WBS, NASPO,
-- margin, contingency, scoring, lead-conversion RPCs, or any data.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Restore quotes_scoped() verbatim to its captured pre-change state:
--    exactly 60 output columns, positions 1–60 unchanged, ending
--      57 geographic_scope
--      58 geographic_scope_other_detail
--      59 pricing_schedule
--      60 pricing_schedule_other_detail
--    Paste the captured definition byte-for-byte. Make NO edits at all.
-- ---------------------------------------------------------------------

<PASTE_CAPTURED_PRE_CHANGE_QUOTES_SCOPED_DEFINITION_HERE>
-- ^ Placeholder intentionally causes a syntax error if left in place.

-- Restore the captured owner (postgres) and the captured grant set only if
-- the restore used DROP + CREATE rather than CREATE OR REPLACE:
-- ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
-- <PASTE_CAPTURED_GRANT_STATEMENTS_HERE>
-- Captured baseline includes EXECUTE for authenticated. Do not add a
-- service_role grant. Do not grant EXECUTE to anon or PUBLIC.

-- ---------------------------------------------------------------------
-- 2. Drop Q3.4 constraints (before the columns, no CASCADE anywhere).
--    Names are provisional pending open decisions D1–D3.
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_billing_preference_other_detail_check;
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_billing_preference_check;

-- ---------------------------------------------------------------------
-- 3. Drop Q3.4 columns, returning public.quotes to its captured 60-column
--    shape. DESTRUCTIVE: any billing preference values entered between
--    forward and rollback are permanently lost. Export them first:
--      SELECT id, billing_preference, billing_preference_other_detail
--      FROM public.quotes WHERE billing_preference IS NOT NULL;
--    (Second column is subject to open decision D1.)
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  DROP COLUMN IF EXISTS billing_preference_other_detail,
  DROP COLUMN IF EXISTS billing_preference;

-- ---------------------------------------------------------------------
-- 4. Triggers and policies — nothing to restore under the current draft,
--    because the forward draft adds no trigger and changes no policy.
--    Open decision D7 (separate trigger vs. extending an existing trigger)
--    is UNRESOLVED. If review approves either option, the exact inverse
--    statements must be added here in the same approval round:
--      - separate trigger  -> DROP TRIGGER + DROP FUNCTION for the new object;
--      - extended trigger  -> CREATE OR REPLACE restoring the captured body
--                             of quotes_enforce_pricing_schedule_authorization
--                             verbatim.
--    After rollback, all five captured triggers must be present and
--    behaviourally unchanged:
--      enforce_quote_state, notify_quote_reassignment,
--      notify_quote_state_change,
--      quotes_enforce_pricing_schedule_authorization, quotes_updated_at.
-- ---------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';

COMMIT;

-- After rollback: re-run 0_capture.sql and diff against the pre-change
-- capture. Expect 60 columns, 13 rows (unless rows changed through normal
-- application use), the captured function definition and properties, the
-- captured grants, the captured RLS policies, and all five triggers.
