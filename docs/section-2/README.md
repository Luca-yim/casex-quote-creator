# Section 2 — Q2.2 Geographic Scope & Q2.3 Pricing Schedule (migration package)

**Status: prepared, NOT applied.** No DDL has been executed and nothing is
deployed. Application code for Section 2 is implemented separately.

## Execution order (when separately approved)

1. **`0_capture.sql`** — mandatory step zero, read-only. Confirms the live
   `quotes_scoped()` definition, owner, security mode, grants and the absence
   of name collisions. The forward migration is written against the
   post-Section-1 captured state (57-column RETURNS TABLE); if the live
   definition differs, **stop** and re-derive the forward/rollback pair.
2. **`1_forward.sql`** — one transaction:
   - four new nullable `quotes` columns with **no database defaults**
     (`geographic_scope`, `geographic_scope_other_detail`, `pricing_schedule`,
     `pricing_schedule_other_detail`);
   - two guarded check constraints (NOT VALID → VALIDATE) for the v6.4
     option sets;
   - **new authorization trigger**
     `quotes_enforce_pricing_schedule_authorization` — the narrowly required
     authorization change, fired **BEFORE INSERT OR UPDATE** because the
     existing `quotes` INSERT policy does not restrict these columns. Only
     estimator/admin may set or change
     `pricing_schedule`/`pricing_schedule_other_detail`. NULL/NULL on INSERT is
     always allowed so Ballpark and lead-converted quotes are unaffected. The
     documented trusted context is `auth.uid() IS NULL` (service_role,
     migrations as postgres, scheduled jobs); the anon role has no
     insert/update grant on `quotes`, and SECURITY DEFINER RPCs keep the
     caller's `auth.uid()`, so neither reaches that branch. It depends on
     **`public.current_user_role()`**, the only role primitive verified present
     in the live capture (it is already called by `quotes_scoped()`).
     `private.has_role` was rejected: capture query 6 returned no rows for it,
     and no replacement role function is created. RLS policies are untouched;

   - `quotes_scoped()` DROP + CREATE (explicit RETURNS TABLE cannot be
     changed by CREATE OR REPLACE) appending four output columns:
     geographic scope visible to sales_rep/estimator/admin and hidden from
     external users; `pricing_schedule` visible to estimator/admin always and
     to sales reps only as the post-approval label on quotes they own;
     `pricing_schedule_other_detail` estimator/admin only. Existing WHERE
     clause, role filtering and margin/contingency masking are byte-identical;
   - owner/grants restored (postgres + authenticated only — no service_role,
     matching the Section 1 capture);
   - `NOTIFY pgrst, 'reload schema'` after commit.
3. **`VERIFY.sql`** — column/constraint/trigger/security/masking checks.
4. **`2_rollback.sql`** — restores the Section 1 function verbatim, drops the
   trigger and function, then the two constraints and four columns. No
   CASCADE.

## Deliberately excluded (separate approvals)

- Price-book freeze artifacts; any pricing-basis behavior (selecting
  `custom`/`other` stores the declared schedule only); NASPO trigger changes;
  changes to `convert_lead_to_quote`, `claim_and_convert_lead`,
  `estimator_assign_and_convert` (new columns simply stay NULL on converted
  quotes); Phase 1A objects; PDFs; Excel; realtime; workflow states.
