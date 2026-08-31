-- Lead Queue permissions: make the UI's gating a server-side guarantee.
--
-- Run against the app project (lsmrxbpvmvrzpbtjqygh), NOT the Lovable Cloud
-- backend — `public.lead_intakes` lives only on the app project.
--
-- WHY THIS EXISTS
-- ---------------
-- `internal_updates_lead` lets sales_rep, estimator and admin update ANY
-- column on ANY lead row. `src/features/leads/permissions.ts` narrows two
-- actions in the UI only:
--
--   * assign to rep  -> admin only
--   * mark duplicate -> estimator + admin
--
-- Until this file is applied those are conventions a sales_rep can bypass
-- with a REST client. `src/test/db/lead-permissions.test.ts` asserts the
-- server-side behaviour and will FAIL against the broad policy — that
-- failure is the point: it is the gap this migration closes.

BEGIN;

-- 1. Helper: the row the caller is trying to write, restricted to the fields
--    a sales_rep is allowed to move. Anything else must come from an
--    estimator or admin.

DROP POLICY IF EXISTS internal_updates_lead ON public.lead_intakes;

-- 2. Estimators and admins keep full update rights over the triage columns.

CREATE POLICY lead_triage_full_update
  ON public.lead_intakes
  FOR UPDATE
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'estimator') OR private.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'estimator') OR private.has_role(auth.uid(), 'admin')
  );

-- 3. Sales reps may only self-claim and qualify/disqualify.
--
--    * assigned_rep_id may only ever be set to themselves (self-claim), never
--      to another user — that is reassignment, which is admin work.
--    * status may only land on 'claimed' | 'qualified' | 'disqualified'.
--      'duplicate' is excluded: merging lead identities is a data-integrity
--      act reserved for estimators and admins.
--    * duplicate_of_lead_id must stay NULL for a rep write.

CREATE POLICY lead_rep_self_claim_update
  ON public.lead_intakes
  FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'sales_rep'))
  WITH CHECK (
    private.has_role(auth.uid(), 'sales_rep')
    AND (assigned_rep_id IS NULL OR assigned_rep_id = auth.uid())
    AND (claimed_by IS NULL OR claimed_by = auth.uid())
    AND status IN ('new', 'claimed', 'qualified', 'disqualified')
    AND duplicate_of_lead_id IS NULL
  );

COMMIT;

-- VERIFY
-- select polname, polcmd, pg_get_expr(polwithcheck, polrelid)
--   from pg_policy where polrelid = 'public.lead_intakes'::regclass;
