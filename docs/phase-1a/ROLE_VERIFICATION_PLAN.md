# Phase 1A — Role-based verification plan

**Every test below REQUIRES EXTERNAL EXECUTION. None has been run. No result
in this document may be reported as passing.**

Run the whole matrix twice: once in staging BEFORE applying migrations A–D
(to capture the baseline), once AFTER. A test whose behaviour is identical
before and after is not evidence that Phase 1A worked — compare against the
"expected after" column.

## Test identities

| Identity | How to obtain | Notes |
|---|---|---|
| Anonymous (no JWT) | `anon` publishable key, no session | Represents an unauthenticated HTTP caller |
| Anonymous session | `supabase.auth.signInAnonymously()` equivalent; in CI the repo uses an admin-minted disposable user (`mintDisposableSubmitter()`, `src/test/db/supabase-clients.ts`) because the public endpoint is CAPTCHA-gated | This is the identity that submits a public lead |
| Sales representative | Seeded user with `user_roles.role = 'sales_rep'` | `src/test/db/setup-test-users.ts` |
| Estimator | `user_roles.role = 'estimator'` | same |
| Admin | `user_roles.role = 'admin'` | same |

Harness already present in the repository: `src/test/db/*.test.ts`, run via
`vitest.db.config.ts`. It skips silently without
`E2E_SUPABASE_SERVICE_ROLE_KEY`, so confirm the tests actually executed
before reading anything into a green run.

## Matrix

Legend: **A** allow, **D** deny (error or zero rows).

| # | Action | Anonymous | Anon session | Sales rep | Estimator | Admin |
|---|---|---|---|---|---|---|
| 1 | `select * from pricing_catalog` | D | D | A | A | A |
| 2 | `insert into pricing_catalog` | D | D | D | D | A |
| 3 | `update pricing_catalog set unit_price` | D | D | D | D | A |
| 4 | `delete from pricing_catalog` | D | D | D | D | D (no grant) |
| 5 | `select * from ballpark_sizing_reference` | D | D | A | A | A |
| 6 | `select * from rate_cards` | D | D | D | A | A |
| 7 | `update rate_cards` | D | D | D | D | A |
| 8 | `select * from vertical_labels` / `vertical_solutions` | A | A | A | A | A |
| 9 | `insert into vertical_solutions` | D | D | D | D | A |
| 10 | `insert into lead_intakes` (public intake) | D | **A** | A | A | A |
| 11 | `select lead_number from lead_intakes where id = <own>` | D | **A** | A | A | A |
| 12 | `select * from lead_intakes` (whole queue) | D | D | A | A | A |
| 13 | `rpc claim_and_convert_lead` | D | D | A | A | A |
| 14 | `rpc convert_lead_to_quote` | D | D | A | A | A |
| 15 | `rpc estimator_assign_and_convert` | D | D | D | A | A |
| 16 | `rpc quotes_scoped` | D | D | A (own, pricing nulled) | A (all actionable) | A (all) |
| 17 | `select * from quotes` (base table, another rep's row) | D | D | D | per policy | A |
| 18 | `rpc transition_quote` → `approved` | D | D | **D** | A | A |
| 19 | `update quotes set margin_percent` as rep | – | – | D | A | A |
| 20 | `insert into user_roles` (role assignment) | D | D | D | D | A |
| 21 | `select * from quote_wbs_lines` for another user's quote | D | D | **see I-1** | A | A |
| 22 | `select * from past_deployments` / `pricing_reviews` | D | D | D | D | D (service role only) |

Rows 10 and 11 are the **preserve-the-public-workflow** checks. If either
fails after applying the migrations, stop and roll back — the public
`/get-a-quote` flow is broken.

Row 18 is the **sales cannot approve** check and must be enforced inside
`transition_quote`, not by the UI.

Row 21 is unresolved: no repository evidence describes the RLS on
`quote_wbs_lines` / `quote_cost_items`. Record the observed behaviour as a
finding; it drives the Phase 1B scope.

## Execution notes

- Run each read/write with the target role's JWT against PostgREST, not as a
  superuser in the SQL editor — the SQL editor bypasses RLS and will make
  every test look like "allow".
- For deny cases, accept either a `42501` permission error or an empty
  result set; record which one occurred, because a silent empty set from a
  missing grant looks the same as a correct policy denial.
- Capture the raw response for each cell. "It looked fine in the UI" is not
  a result — the UI hides actions it believes the role cannot perform
  (`src/features/leads/permissions.ts`, `src/lib/quote-workflow.ts`), which
  is presentation, not enforcement.
