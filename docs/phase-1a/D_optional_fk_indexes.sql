-- =====================================================================
-- Phase 1A / Migration D — OPTIONAL foreign-key indexes.
--
-- STATUS: PREPARED, NOT APPLIED. Performance only — contains NO security
-- change and is intentionally separated from migrations A/B/C so it can be
-- applied, deferred or skipped independently.
--
-- EVIDENCE BASIS
--   Confirmed from repository evidence — column names taken from the
--   generated types (src/lib/database.types.ts) and from filter/join usage:
--     lead_intakes.assigned_rep_id, .claimed_by  — FKs named explicitly in
--       src/features/leads/useLeadQueue.ts:25-26
--       (lead_intakes_assigned_rep_id_fkey, lead_intakes_claimed_by_fkey)
--     lead_intakes.converted_quote_id, .duplicate_of_lead_id
--     quotes.lead_id, .owner_id, .requested_by, .reviewed_by, .approved_by
--     quote_wbs_lines.quote_id, quote_cost_items.quote_id
--     quote_versions.quote_id, quote_pdfs.quote_id, notifications.quote_id
--   Confirmed already indexed: quotes.last_reviewed_by
--     (quotes_last_reviewed_by_idx, docs/SESSION_5B_PERMISSIONS.sql).
--   Expected but unverified: notifications.user_id, quote_comments.quote_id —
--     these tables are used by the app but their columns are not all
--     enumerated above; the DO block below skips any column that does not
--     exist rather than failing.
--   Unknown: which of these indexes already exist under a different name.
--     A duplicate index is wasteful but harmless; section 9 of
--     VERIFY_phase_1a.sql lists unindexed FKs so the DBA can trim this list
--     before applying.
--
-- LOCKING NOTE: plain CREATE INDEX takes a SHARE lock and blocks writes on
-- that table for the duration. On a small dataset this is milliseconds. If
-- these tables have grown, run the CONCURRENTLY variants listed at the
-- bottom instead — those CANNOT run inside a transaction block, so run them
-- one at a time with autocommit.
--
-- DESTRUCTIVE OPERATIONS: none.
-- =====================================================================

BEGIN;

DO $phase1a_idx$
DECLARE
  t   text;
  c   text;
  idx text;
  pairs text[][] := ARRAY[
    ARRAY['lead_intakes',     'assigned_rep_id'],
    ARRAY['lead_intakes',     'claimed_by'],
    ARRAY['lead_intakes',     'converted_quote_id'],
    ARRAY['lead_intakes',     'duplicate_of_lead_id'],
    ARRAY['quotes',           'lead_id'],
    ARRAY['quotes',           'owner_id'],
    ARRAY['quotes',           'requested_by'],
    ARRAY['quotes',           'reviewed_by'],
    ARRAY['quotes',           'approved_by'],
    ARRAY['quote_wbs_lines',  'quote_id'],
    ARRAY['quote_cost_items', 'quote_id'],
    ARRAY['quote_versions',   'quote_id'],
    ARRAY['quote_pdfs',       'quote_id'],
    ARRAY['quote_comments',   'quote_id'],
    ARRAY['notifications',    'quote_id'],
    ARRAY['notifications',    'user_id'],
    ARRAY['pricing_reviews',  'quote_id']
  ];
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    t := pairs[i][1];
    c := pairs[i][2];

    -- Skip silently when the table or column is absent, so this file never
    -- fails on a schema that differs from the generated types.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = c
    ) THEN
      RAISE WARNING 'Phase 1A/D: skipped public.%.% (not found)', t, c;
      CONTINUE;
    END IF;

    idx := format('%s_%s_idx', t, c);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)', idx, t, c
    );
    RAISE NOTICE 'Phase 1A/D: ensured index %', idx;
  END LOOP;
END
$phase1a_idx$;

COMMIT;

-- ---------------------------------------------------------------------
-- CONCURRENT ALTERNATIVE (run outside a transaction, one statement at a
-- time, if any of these tables is large enough that a write lock matters):
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_intakes_claimed_by_idx
--     ON public.lead_intakes (claimed_by);
--   ... repeat per pair above ...
--
-- After a CONCURRENTLY run, check for invalid indexes:
--   SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE NOT i.indisvalid;
-- ---------------------------------------------------------------------

-- =====================================================================
-- ROLLBACK GUIDANCE
--   DROP INDEX IF EXISTS public.<index_name>;
--   e.g. DROP INDEX IF EXISTS public.lead_intakes_claimed_by_idx;
--   Dropping an index never affects data or security posture.
-- =====================================================================
