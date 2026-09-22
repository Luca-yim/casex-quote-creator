-- =====================================================================
-- Section 3 / Q3.4 (Billing Preference) — ROLLBACK **DRAFT**
-- =====================================================================
-- STATUS: DRAFT. NOT EXECUTABLE until the pre-change live capture from
-- 0_capture.sql has been preserved and pasted below.
--
-- WARNING — PRESERVE THE PRE-CHANGE CAPTURE.
--   This rollback restores quotes_scoped() to its PRE-Q3.4 definition. That
--   definition can only come from the 0_capture.sql output taken BEFORE
--   1_forward.sql ran. If that capture was not saved, DO NOT RUN THIS FILE:
--   there is no safe source for the prior body, and reconstructing it from
--   the repository would silently discard live drift, Section 1, Section 2,
--   Q3.1a or Q3.2 behaviour.
--
-- This rollback removes ONLY Q3.4 objects. It must not touch Section 1,
-- Section 2, Q3.1a, Q3.2, the Section 2 authorization trigger, the quotes
-- RLS policies, pricing objects, lead-conversion RPCs, or any data.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Restore quotes_scoped() verbatim to its pre-Q3.4 state.
--    Paste the captured definition byte-for-byte. Make NO edits at all.
-- ---------------------------------------------------------------------

<PASTE_PRE_CHANGE_QUOTES_SCOPED_DEFINITION_HERE>
-- ^ Placeholder intentionally causes a syntax error if left in place.

-- Restore the captured owner and grants only if the restore used
-- DROP + CREATE rather than CREATE OR REPLACE:
-- ALTER FUNCTION public.quotes_scoped() OWNER TO <PASTE_CAPTURED_OWNER_HERE>;
-- <PASTE_CAPTURED_GRANT_STATEMENTS_HERE>
-- Do not add a service_role grant. Do not grant EXECUTE to anon or PUBLIC.

-- ---------------------------------------------------------------------
-- 2. Drop Q3.4 constraints (before the columns, no CASCADE anywhere).
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_billing_preference_other_detail_check;
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_billing_preference_check;

-- ---------------------------------------------------------------------
-- 3. Drop Q3.4 columns. DESTRUCTIVE: any billing preference values entered
--    between forward and rollback are permanently lost. Export them first
--    if they matter:
--      SELECT id, billing_preference, billing_preference_other_detail
--      FROM public.quotes WHERE billing_preference IS NOT NULL;
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  DROP COLUMN IF EXISTS billing_preference_other_detail,
  DROP COLUMN IF EXISTS billing_preference;

-- ---------------------------------------------------------------------
-- 4. Triggers and policies — NOTHING TO RESTORE.
--    The forward draft adds no trigger and changes no policy (decision D4).
--    Section 2's quotes_enforce_pricing_schedule_authorization must still be
--    present after this rollback; VERIFY.sql check S2-3 asserts that.
--    If review overturns D4 and a Q3.4 trigger is added, the matching
--    DROP TRIGGER / DROP FUNCTION statements must be added here in the same
--    approval round.
-- ---------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';

COMMIT;

-- After rollback: re-run 0_capture.sql and diff against the pre-change
-- capture. Columns, constraints, function definition, owner, grants,
-- policies, triggers and row count must all match the pre-change baseline.
