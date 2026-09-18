# Phase 1A — Minimal security-fix package (REVISED 2026-09-18, approval update)

**Status: prepared but NOT applied and NOT verified.** Every file here is
for external DBA review and execution. No database modification was
performed from this workspace.

**Verified complete: server-side approval authorization.** The live
`public.enforce_quote_state_transition()` trigger function was inspected
(SECURITY DEFINER, owner `postgres`, search_path `public`) and verified to
permit `under_review → approved` only for `estimator` and `admin` roles.
Sales representatives cannot approve; external users cannot approve. This is
enforced server-side by the database trigger, not only by the frontend.
**No approval-transition migration is required**, and
`0_approval_transition_fix.sql` has been removed from the package.
Definition inspected: verified. Live role-based execution tests: still
required in staging (see ROLE_VERIFICATION_PLAN.md).

## What changed in this revision

The package was cut down to only the fixes the live read-only audit
identified as necessary. Removed from the executable set:

- All changes to `ballpark_sizing_reference` and `phase_weight_allocation`
  (previously in Migration A) — their access is left exactly as found.
- All changes to `past_deployments` and `pricing_reviews` (previously in
  Migration C) — demoted to investigation notes.
- Any change to `quote_wbs_lines` / `quote_cost_items` — their access is
  **preserved as Estimator/Admin-only**; nothing in Phase 1A touches them.
- Admin write grants/policies on `vertical_labels` / `vertical_solutions`
  — no application write path exists, so no write grant is issued.
- The blanket search_path rewrite (previously Migration B) — replaced by a
  single targeted fix on `handle_new_user()`.
- All `service_role` grants — none are proven necessary by repository or
  live evidence.

## Minimal deployment set

| Order | File | Scope | Condition |
|---|---|---|---|
| 1 | `VERIFY_phase_1a.sql` | Read-only pre-state capture | Run FIRST; save the output — it is the rollback reference |
| 2 | `A_pricing_catalog_rls_grants.sql` | `public.pricing_catalog` only: RLS on, anon revoked, authenticated DELETE removed, SELECT preserved (temporary), INSERT/UPDATE admin-gated | unconditional |
| 3 | `B_function_grants_search_path.sql` | EXECUTE scoping on RPCs; guarded revoke on `_convert_lead_core`; trigger-function API revokes; `handle_new_user()` search_path | Section 3 self-guards on wrapper SECURITY DEFINER check |
| 4 | `C_rls_policy_corrections.sql` | `vertical_labels` / `vertical_solutions` read-only RLS for the public intake flow | unconditional |
| 4 | `D_optional_fk_indexes.sql` | FK indexes | **DEFERRED — not part of minimal Phase 1A** |

## Key open items (all documented in-file)

- **Approval authorization: RESOLVED.** `enforce_quote_state_transition()`
  is verified to gate `under_review → approved` on estimator/admin. The
  conditional fix file was deleted; staging now only *tests* the existing
  control via the role matrix. The verified transition table is recorded in
  VERIFY_phase_1a.sql section 5b.
- **Supabase anonymous Auth users** are expected to reach Postgres as
  `authenticated`, not `anon` — treated as authenticated unless live testing
  proves otherwise (`ROLE_VERIFICATION_PLAN.md`).
- **Authenticated SELECT on `pricing_catalog` is temporary** — the
  application relies on it for the external dashboard and PDFs; column-level
  confidentiality is application-layer only.
- **Admin catalog writes** are asserted by policy but pending external
  verification.
- `profiles.role` and `pricing_catalog.naspo_discount_price` may not exist —
  VERIFY section 10 resolves both conflicts.
- **Lifecycle observation (not a Phase 1A blocker):** the verified function
  permits `draft → archived` for external, sales_rep, estimator and admin.
  Marked as *product behavior to confirm separately*; Phase 1A does not
  change it.

## Companion documents

- `VERIFY_phase_1a.sql` — read-only pre/post checks (sections 2b, 6b, 8b, 10
  are new: effective table/function privileges, `_convert_lead_core` guard,
  WBS/cost-table capture, schema-conflict resolution).
- `ROLE_VERIFICATION_PLAN.md` — role-by-role test matrix, now separating
  no-JWT anon callers from Supabase anonymous Auth users, and requiring raw
  database results to be recorded separately from UI masking.
- `APPLICATION_COMPATIBILITY.md` — application read/write paths the
  migrations must not break (unchanged in this revision).

## Execution order

1. Run `VERIFY_phase_1a.sql` in staging. Save the full output.
2. Inspect section 5's output for `enforce_quote_state_transition`. Decide
   whether `0_approval_transition_fix.sql` applies; finalise its template
   against the live signature if it does.
3. Apply A, B, C (and 0 if condition met) one at a time, re-running the
   relevant VERIFY sections between each.
4. Run the `ROLE_VERIFICATION_PLAN.md` matrix with real JWTs against
   PostgREST; diff against the pre-state capture.
5. `D_optional_fk_indexes.sql` is deferred to a later performance pass.
