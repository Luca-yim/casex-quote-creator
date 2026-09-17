# Phase 1A — Database security migrations: final report

**Status: Phase 1A prepared but not applied or verified.**

No SQL was executed. No migration was applied. No database object was
inspected, modified or verified. Every database statement in these files is
derived from repository source, existing migration files, generated types,
repository SQL notes, and the RPC calls the application makes.

## 1. Files created

| File | Purpose |
|---|---|
| `docs/phase-1a/A_pricing_catalog_rls_grants.sql` | RLS + grants for `pricing_catalog`, `ballpark_sizing_reference`, `rate_cards`, `phase_weight_allocation`; admin-only write paths |
| `docs/phase-1a/B_function_grants_search_path.sql` | Fixed `search_path` and EXECUTE grants for SECURITY DEFINER functions; revokes `anon` EXECUTE everywhere |
| `docs/phase-1a/C_rls_policy_corrections.sql` | Lookup-table RLS, deny-by-default for unused tables, plus five written-up investigation items with no SQL |
| `docs/phase-1a/D_optional_fk_indexes.sql` | Optional FK indexes — performance only, no security change |
| `docs/phase-1a/VERIFY_phase_1a.sql` | Read-only verification, 11 sections. Run before and after |
| `docs/phase-1a/ROLE_VERIFICATION_PLAN.md` | 22-row role/action matrix — requires external execution |
| `docs/phase-1a/APPLICATION_COMPATIBILITY.md` | Read/write paths, anonymous surface, required app changes, repository conflicts |

No application code, test, schema or configuration file was modified.

## 2. Confirmed from repository evidence

- Catalog-family tables are read from the browser as `authenticated`; the
  client performs **no** writes to any of them.
- The only anonymous database operations are `INSERT` into
  `public.lead_intakes` and a self-scoped `SELECT` of `lead_number`, plus
  reads of `vertical_labels` / `vertical_solutions`.
- Six RPCs are called from the client, all authenticated:
  `quotes_scoped`, `quote_versions_scoped`, `transition_quote`,
  `convert_lead_to_quote`, `claim_and_convert_lead`,
  `estimator_assign_and_convert`.
- `private.has_role(uuid, public.app_role)` is the current role predicate;
  `public.has_role` was dropped in
  `supabase/migrations/20260820193207_*.sql`.
- `public.profiles`, `public.user_roles`, the `private` schema, the
  `app_role` enum, `handle_new_user`, `update_updated_at_column` and their
  triggers all exist with the definitions in `supabase/migrations/`.
- Pricing confidentiality for external users is enforced only in
  application code (`src/lib/quote-columns.ts`).

## 3. Assumed but unverified

- Current RLS status, policy names and grants on every table except
  `profiles` and `user_roles`.
- The argument types of `transition_quote` (migration B tries both
  candidates; the wrong one is a guarded no-op).
- Existence and signature of `_convert_lead_core(...)` — left as a clearly
  marked placeholder in migration B.
- Whether `pricing_catalog.naspo_discount_price` exists.
- Whether `profiles.role` exists, and therefore whether the `quote_pdfs`
  internal-PDF policies in `docs/QUOTE_PDFS_INTERNAL_SCOPE.sql` are live.
- Ownership/RLS on `quote_wbs_lines` and `quote_cost_items` — unknown, and
  the highest-severity open item.
- Whether the state-machine trigger on `quotes` matches
  `docs/SESSION_5B_PERMISSIONS.sql`.

## 4. SQL requiring DBA review before execution

1. **Migration A, `rate_cards` read policy** — restricted to
   estimator/admin. If sales reps are meant to open the WBS editor
   read-only, add `sales_rep` first.
2. **Migration B, the two `transition_quote` signatures** — confirm which
   exists via verification section 3.
3. **Migration B, `_convert_lead_core` placeholder** — fill in or delete.
4. **Migration B, `current_user_role()`** — keeps `authenticated` EXECUTE on
   purpose; revoking it can break every `quotes` policy.
5. **Migration C, section 2** — enabling RLS with no policy on
   `past_deployments` / `pricing_reviews` locks them to `service_role`.
   Confirm no internal tool reads them with a user JWT.
6. **Migration C, investigation items I-1 … I-5** — findings only, no SQL.
   I-1 (`quote_wbs_lines` / `quote_cost_items`) should drive Phase 1B.
7. **Migration D** — trim against verification section 9 to avoid duplicate
   indexes; use the `CONCURRENTLY` variants if the tables are large.

## 5. Potential breaking changes

| Risk | Affected surface | Mitigation |
|---|---|---|
| `anon` loses SELECT on `vertical_labels` / `vertical_solutions` if the policies in C are altered | Public intake vertical/solution pickers | Policies deliberately include `anon`; verify with matrix row 8 |
| `anon` EXECUTE revoked on RPCs | None known — no anonymous RPC call exists | Matrix rows 10–11 confirm intake still works |
| `rate_cards` read narrowed to estimator/admin | WBS editor for any other role | Matrix row 6; adjust the policy before applying if needed |
| RLS newly enabled on a table that had it off | Any unlisted consumer using a user JWT | Verification section 1 pre-state; rollback drops the policies and disables RLS |
| Deny-by-default on `past_deployments` / `pricing_reviews` | Unlisted internal tooling | Verification section 2 pre-state |
| Index creation write lock | Large tables during migration D | Use the `CONCURRENTLY` variants |

## 6. Required staging setup

1. A staging Supabase project restored from a recent production snapshot —
   schema **and** the pricing reference rows, since Ballpark and Proposal
   maths depend on real catalog values.
2. Seeded test identities for all four roles
   (`src/test/db/setup-test-users.ts`).
3. `E2E_SUPABASE_SERVICE_ROLE_KEY` set for the staging project, otherwise
   the repository's database tests skip silently and a green run means
   nothing.
4. A Turnstile-exempt or admin-minted anonymous submitter for the public
   intake test (`mintDisposableSubmitter()` in
   `src/test/db/supabase-clients.ts`).
5. The app pointed at staging so the UI paths in the compatibility report
   can be exercised by hand.

## 7. Exact post-application verification steps

1. Run `VERIFY_phase_1a.sql` **before** applying anything; save the output
   as the rollback reference.
2. Apply `A`, then rerun verification sections 1, 2, 7.
3. Apply `B`, then rerun sections 3, 4, 5, 6. Section 4 must return zero
   rows. Section 6 must show `anon` with EXECUTE on nothing.
4. Apply `C`, then rerun sections 1, 7, 8. Triage every row of section 8.
5. Run section 11 and resolve conflicts C-1 and C-2 from the compatibility
   report.
6. Execute the full role matrix in `ROLE_VERIFICATION_PLAN.md`, recording
   the raw response per cell. Rows 10, 11, 18 and 20 are release blockers.
7. Exercise by hand in staging: public `/get-a-quote` submission end to
   end; lead queue load; claim-and-convert; quote open and autosave;
   estimator WBS edit; PDF download (customer and internal); admin role
   assignment.
8. Only then apply `D`, and rerun section 9.

## 8. Rollback instructions

Each migration file ends with its own rollback block. In general:

- **A and C** — drop the named policies, restore the pre-state grants from
  the saved verification output, and `DISABLE ROW LEVEL SECURITY` only on
  tables that had it off beforehand.
- **B** — `ALTER FUNCTION … RESET search_path` and re-grant EXECUTE to the
  prior grantees. No function is dropped or redefined, so nothing is lost.
- **D** — `DROP INDEX IF EXISTS public.<name>;` Safe at any time.

Apply each migration in its own transaction so a failure rolls itself back.
If a role-matrix blocker fails after a migration, roll that migration back
before investigating; do not leave a partially hardened state in place.

## 9. What was NOT done, by instruction

- Recurring Proposal pricing — untouched.
- Ballpark behaviour — untouched.
- No application code, tests or configuration changed.
- No SQL run, no migration applied, no database object verified.

**Phase 1A prepared but not applied or verified.**
