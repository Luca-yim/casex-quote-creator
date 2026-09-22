-- =====================================================================
-- Section 3 / Q3.4 (Billing Preference) — FORWARD MIGRATION **DRAFT**
-- =====================================================================
-- STATUS: DRAFT. NOT EXECUTABLE. NOT APPROVED. NOT APPLIED.
--
-- HARD STOP #1 — live capture required.
--   Run 0_capture.sql first. This file contains placeholders that MUST be
--   replaced with the captured live definition before any execution. Running
--   it as-is will fail (by design) rather than overwrite quotes_scoped()
--   with a guessed body.
--
-- HARD STOP #2 — open approval decisions (see README.md §"Open decisions"):
--   D1 — is billing_preference_other_detail a separate column? (draft: YES)
--   D2 — is "Annual quarterly" a UI default only, or persisted? (draft: no
--        database default, value only ever written explicitly by the app)
--   D3 — is the "Other" detail requirement enforced in the database, or in
--        Zod only, as Q2.2/Q2.3 do? (draft: Zod only; no DB check)
--   D4 — is a write-authorization trigger required at all? (draft: NO —
--        Q3.4 is writable by sales_rep, estimator and admin, i.e. every role
--        that already holds an UPDATE path on its own quotes, so no new
--        trigger is justified. External users are excluded by the existing
--        quotes RLS policies, not by anything added here.)
--
-- Scope: two nullable text columns, two guarded check constraints, and an
-- APPEND of two masked outputs to quotes_scoped(). Nothing else.
-- Pricing, WBS, rate cards, NASPO, margin, contingency, scoring, approval
-- locks, snapshots, realtime, lead-conversion RPCs, Ballpark behaviour and
-- public lead intake are all untouched.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columns — nullable, NO database default, no backfill.
--    Every existing row stays NULL; existing quotes remain valid.
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS billing_preference              text,
  ADD COLUMN IF NOT EXISTS billing_preference_other_detail text;
-- ^ second column is subject to decision D1.

COMMENT ON COLUMN public.quotes.billing_preference IS
  'v6.4 Q3.4 Billing Preference (Proposal-only; optional; no pricing effect)';
COMMENT ON COLUMN public.quotes.billing_preference_other_detail IS
  'v6.4 Q3.4 Other detail (free text; required by application validation when billing_preference = ''other'')';

-- ---------------------------------------------------------------------
-- 2. Option constraints — guarded, NOT VALID then VALIDATE so the table is
--    not long-locked and pre-existing NULL rows cannot fail.
--    Stored values are snake_case identifiers; labels live in the app.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_billing_preference_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_billing_preference_check
      CHECK (billing_preference IS NULL
             OR billing_preference IN ('monthly','annual_upfront','annual_quarterly','other'))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_billing_preference_check;

-- Optional, subject to decision D3. Only enforces that detail text is not
-- attached to a non-"other" selection; it deliberately does NOT require
-- detail when 'other' is chosen, because requiredness is an application
-- submission rule (Q3.4 is optional for completion/submission/approval) and
-- a DB-level NOT NULL rule would break autosaved intermediate drafts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_billing_preference_other_detail_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_billing_preference_other_detail_check
      CHECK (billing_preference_other_detail IS NULL
             OR billing_preference = 'other')
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_billing_preference_other_detail_check;

-- ---------------------------------------------------------------------
-- 3. Write authorization — NONE ADDED (decision D4).
--    Q3.4 is writable by sales_rep, estimator and admin. Those are exactly
--    the roles the existing quotes RLS policies already permit to update the
--    rows in question, so no new trigger or policy is introduced. Existing
--    Section 2 trigger quotes_enforce_pricing_schedule_authorization is left
--    completely untouched and must still fire BEFORE INSERT OR UPDATE.
--    If review overturns D4, the trigger belongs in a SEPARATE, separately
--    approved migration — not here.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 4. quotes_scoped() — APPEND two masked outputs.
--
--    !!! HARD STOP !!!
--    Do not write this section from the repository. Paste the captured live
--    definition (0_capture.sql query 4) below, then make ONLY these edits:
--      a) append to the END of the RETURNS TABLE list, preserving every
--         existing column name, type and position exactly:
--             , billing_preference text
--             , billing_preference_other_detail text
--      b) append the two masking expressions below to the END of the SELECT
--         list, in the same order;
--      c) change NOTHING else — not the existing masking expressions, not
--         the ownership/role WHERE clause, not LANGUAGE, not SECURITY
--         DEFINER, not STABLE, not SET search_path, not the owner.
--    Confirm the append position against 0_capture.sql query 6 before running.
-- ---------------------------------------------------------------------

<PASTE_LIVE_QUOTES_SCOPED_DEFINITION_HERE>
-- ^ Replace this placeholder line with the captured CREATE OR REPLACE
--   FUNCTION statement, edited per (a)-(c) above. Leaving the placeholder in
--   place causes a syntax error and aborts the transaction — intended.

-- Masking expressions to append to the SELECT list (role model for Q3.4:
-- visible to sales_rep, estimator and admin; hidden from external users and
-- from any unknown/NULL role):
--
--     case
--       when public.current_user_role() in ('sales_rep','estimator','admin')
--         then q.billing_preference
--       else null
--     end as billing_preference,
--     case
--       when public.current_user_role() in ('sales_rep','estimator','admin')
--         then q.billing_preference_other_detail
--       else null
--     end as billing_preference_other_detail
--
-- NOTE: unlike pricing_schedule_other_detail, the Q3.4 detail field is NOT
-- estimator/admin-only — the approved classification grants sales reps
-- visibility. Confirm at review.

-- ---------------------------------------------------------------------
-- 5. Owner, security settings and grants — RESTORE EXACTLY AS CAPTURED.
--    CREATE OR REPLACE preserves them, but a DROP+CREATE does not. If the
--    captured definition required DROP+CREATE, re-issue the captured owner
--    and the captured grant set verbatim here. Do NOT invent a
--    service_role grant, and do NOT grant EXECUTE to anon or PUBLIC.
-- ---------------------------------------------------------------------
-- ALTER FUNCTION public.quotes_scoped() OWNER TO <PASTE_CAPTURED_OWNER_HERE>;
-- <PASTE_CAPTURED_GRANT_STATEMENTS_HERE>

-- ---------------------------------------------------------------------
-- 6. PostgREST schema reload — required so the new columns and the new
--    function output are visible to the Data API.
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- After COMMIT: run VERIFY.sql (static checks), then the authenticated
-- session checks it labels, using real sales_rep / estimator / admin /
-- external sessions. No SELECT * appears anywhere in this file.
