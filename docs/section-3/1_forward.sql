-- =====================================================================
-- Section 3 / Q3.4 (Billing Preference) — FORWARD MIGRATION **DRAFT**
-- =====================================================================
-- STATUS: DRAFT. **NOT EXECUTABLE.** NOT APPROVED. NOT APPLIED.
--
-- Live capture status: COMPLETE (0_capture.sql; README.md §1b). Verified:
--   - public.quotes has 60 columns and 13 rows;
--   - no Billing Preference column, no Other-detail column, no Q3.4
--     constraint, no Q3.4 name collision;
--   - quotes_scoped() returns exactly 60 columns, positions 57–60 being
--     geographic_scope, geographic_scope_other_detail, pricing_schedule,
--     pricing_schedule_other_detail;
--   - quotes_scoped() is SECURITY DEFINER, STABLE, SQL language, owner
--     postgres, search_path = public; EXECUTE for authenticated observed;
--   - Section 2 constraints present and validated; the Section 2
--     authorization trigger present and must remain behaviourally unchanged;
--   - five non-internal triggers on public.quotes (enforce_quote_state,
--     notify_quote_reassignment, notify_quote_state_change,
--     quotes_enforce_pricing_schedule_authorization, quotes_updated_at);
--   - RLS policies include External draft updates, Sales Representative
--     owned-quote updates, and Estimator/Admin update paths.
--
-- HARD STOP #1 — the captured pre-change quotes_scoped() body is held in the
--   operator's capture output and is deliberately NOT reproduced in this
--   repository. It must be pasted into §4 at execution time. Running this
--   file with the placeholder in place fails by design rather than
--   overwriting the live function with a guessed body.
--
-- HARD STOP #2 — UNRESOLVED APPROVAL DECISIONS. None of the following may be
--   settled by this draft; every one needs explicit approval, and the column,
--   constraint and masking shapes below are provisional illustrations only:
--     D1 — is a separate billing_preference_other_detail column required?
--     D2 — exact stored option values (identifiers and spelling).
--     D3 — is "Annual quarterly" UI-only or persisted?
--     D4 — Sales Representative read/write timing (pre- vs post-approval).
--     D5 — External-user write protection mechanism (the live capture shows
--          an External draft-update RLS path, so external write exposure is
--          an open question, not a settled outcome).
--     D6 — separate new trigger vs. extension of an existing trigger.
--     D7 — database-level "Other"-detail validation vs. Zod only.
--     D8 — PDF/export inclusion.
--
-- Scope ceiling: nullable column(s), guarded constraint(s), and an APPEND to
-- quotes_scoped() after position 60. Nothing else. Pricing, WBS, rate cards,
-- NASPO, margin, contingency, scoring, approval locks, snapshots, realtime,
-- lead-conversion RPCs, Ballpark behaviour, public lead intake, Section 1,
-- Section 2, Q3.1a and Q3.2 are all untouched.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columns — nullable, NO database default, NO backfill.
--    All 13 existing rows must therefore remain NULL for every Q3.4 column;
--    existing quotes stay valid. Verified afterwards by VERIFY.sql A2.
--    Column set and naming are provisional pending D1 and D2.
-- ---------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS billing_preference              text,
  ADD COLUMN IF NOT EXISTS billing_preference_other_detail text;
-- ^ second column is subject to D1 and must not be added unless approved.

COMMENT ON COLUMN public.quotes.billing_preference IS
  'v6.4 Q3.4 Billing Preference (Proposal-only; optional; no pricing effect)';
COMMENT ON COLUMN public.quotes.billing_preference_other_detail IS
  'v6.4 Q3.4 Other detail (free text); enforcement layer pending decision D7';

-- ---------------------------------------------------------------------
-- 2. Option constraint — guarded, NOT VALID then VALIDATE, so the table is
--    not long-locked and the 13 pre-existing NULL rows cannot fail.
--    The value list below is a PLACEHOLDER pending D2/D3; do not treat the
--    identifiers as approved.
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
             OR billing_preference IN (<PASTE_APPROVED_OPTION_VALUES_HERE>))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_billing_preference_check;

-- Optional, subject to D7. Include ONLY if database-level Other-detail
-- validation is approved; otherwise the rule lives in Zod alone, as Q2.2 and
-- Q2.3 do. Note that Q3.4 is optional for completion, submission and
-- approval, so no NOT NULL rule of any kind may be introduced.
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conrelid = 'public.quotes'::regclass
--       AND conname = 'quotes_billing_preference_other_detail_check'
--   ) THEN
--     ALTER TABLE public.quotes
--       ADD CONSTRAINT quotes_billing_preference_other_detail_check
--       CHECK (billing_preference_other_detail IS NULL
--              OR billing_preference = <PASTE_APPROVED_OTHER_VALUE_HERE>)
--       NOT VALID;
--   END IF;
-- END $$;
-- ALTER TABLE public.quotes VALIDATE CONSTRAINT quotes_billing_preference_other_detail_check;

-- ---------------------------------------------------------------------
-- 3. Write authorization — UNRESOLVED (D4, D5, D6). This draft adds NOTHING.
--    The live capture shows an External draft-update RLS path alongside the
--    Sales Representative owned-quote and Estimator/Admin update paths, so
--    it cannot be assumed that RLS alone keeps external users away from the
--    Q3.4 columns. Review must decide between:
--      (a) no new enforcement, if the approved role model tolerates the
--          existing External draft-update path;
--      (b) a new, separately approved trigger; or
--      (c) extending an existing trigger.
--    Option (c) touches quotes_enforce_pricing_schedule_authorization, which
--    the live capture requires to remain behaviourally unchanged for
--    Section 2 — so (c) needs a byte-level before/after review of that
--    function and a matching inverse in 2_rollback.sql.
--    All five captured triggers must remain present regardless of the choice.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 4. quotes_scoped() — APPEND Q3.4 outputs AFTER position 60.
--
--    !!! HARD STOP !!!
--    Paste the captured live definition (0_capture.sql query 4) below, then
--    make ONLY these edits:
--      a) preserve output positions 1–60 exactly — every existing name, type
--         and position, ending 57 geographic_scope,
--         58 geographic_scope_other_detail, 59 pricing_schedule,
--         60 pricing_schedule_other_detail. No reordering, no insertion into
--         the middle, no removal;
--      b) append the approved Q3.4 output(s) to the END of the RETURNS TABLE
--         list, starting at position 61;
--      c) append the matching masking expression(s) to the END of the SELECT
--         list, in the same order;
--      d) change NOTHING else — not the existing masking expressions, not
--         the ownership/role WHERE clause, not LANGUAGE sql, not SECURITY
--         DEFINER, not STABLE, not SET search_path = public, not the owner
--         (postgres).
--    Confirm the append position against 0_capture.sql query 6 (60 columns)
--    before running.
-- ---------------------------------------------------------------------

<PASTE_CAPTURED_QUOTES_SCOPED_DEFINITION_HERE>
-- ^ Replace this placeholder line with the captured CREATE OR REPLACE
--   FUNCTION statement, edited per (a)-(d) above. Leaving the placeholder in
--   place causes a syntax error and aborts the transaction — intended.

-- Masking expression shape to append (role model PENDING D4/D5 — reproduced
-- here only to show the form, not as an approved rule):
--
--     case
--       when public.current_user_role() in (<PASTE_APPROVED_READ_ROLES_HERE>)
--         then q.billing_preference
--       else null
--     end as billing_preference
--
-- The approved classification makes Q3.4 visible to Sales Representatives,
-- Estimators and Admins and hidden from External users; D4 must still settle
-- whether Sales Representative visibility is unconditional or gated on quote
-- state, as pricing visibility is elsewhere in this application.

-- ---------------------------------------------------------------------
-- 5. Owner, security settings and grants — RESTORE EXACTLY AS CAPTURED.
--    CREATE OR REPLACE preserves them; a DROP + CREATE does not. If the
--    captured definition required DROP + CREATE, re-issue the captured owner
--    and the captured grant set verbatim here. Captured baseline: owner
--    postgres, EXECUTE for authenticated observed. Do NOT invent a
--    service_role grant, and do NOT grant EXECUTE to anon or PUBLIC.
-- ---------------------------------------------------------------------
-- ALTER FUNCTION public.quotes_scoped() OWNER TO postgres;
-- <PASTE_CAPTURED_GRANT_STATEMENTS_HERE>

-- ---------------------------------------------------------------------
-- 6. PostgREST schema reload — required so the new column(s) and the new
--    function output(s) become visible to the Data API.
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- After COMMIT: run VERIFY.sql Part A (static/catalog), then Part B using
-- real authenticated sales_rep / estimator / admin / external sessions.
-- No SELECT * appears anywhere in this file.
