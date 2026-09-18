# Phase 1A — Role-based verification plan (REVISED 2026-09-18)

**Every test below REQUIRES EXTERNAL EXECUTION. None has been run. No result
in this document may be reported as passing.**

Run the whole matrix twice: once in staging BEFORE applying the minimal
Phase 1A set (A, B, C), once AFTER.
A test whose behaviour is identical before and after is not evidence that
Phase 1A worked — compare against the "expected after" column.

## Test identities

Four distinct callers, two of which were previously conflated:

| Identity | How to obtain | Postgres role | Notes |
|---|---|---|---|
| Raw anon (no JWT) | `anon` publishable key, **no session** | `anon` | Unauthenticated HTTP caller; no Supabase Auth session at all |
| Supabase anonymous Auth user | `supabase.auth.signInAnonymously()` equivalent; in CI, an admin-minted disposable user (`mintDisposableSubmitter()`, `src/test/db/supabase-clients.ts`) because the public endpoint is CAPTCHA-gated | expected `authenticated` — **treat as authenticated unless live testing proves otherwise** | This is the identity that submits a public lead. It holds a real JWT. NEVER record a result for "anonymous" without saying which of these two callers produced it |
| Sales representative | Seeded user with `user_roles.role = 'sales_rep'` | `authenticated` | `src/test/db/setup-test-users.ts` |
| Estimator / Admin | `user_roles.role = 'estimator'` / `'admin'` | `authenticated` | same |

**Standing instruction for every cell below:** record BOTH (a) the raw
database/RPC outcome (error code, rows returned, column values — what
Postgres/PostgREST actually did) and (b) what the application UI shows for
the same caller. The UI hides actions it believes a role cannot perform
(`src/features/leads/permissions.ts`, `src/lib/quote-workflow.ts`) and nulls
sensitive columns in the projection (`src/lib/quote-columns.ts`) — that is
application masking, not enforcement. A cell is only "safe" when the raw
outcome is a deny; a raw allow hidden by UI masking is a finding.

## Matrix

Legend: **A** allow, **D** deny (error or zero rows).

| # | Action | Raw anon (no JWT) | Anon Auth session | Sales rep | Estimator | Admin |
|---|---|---|---|---|---|---|
| 1 | `select * from pricing_catalog` | D | see caveat† | A | A | A |
| 2 | `insert into pricing_catalog` | D | D | D | D | **A — pending external verification** |
| 3 | `update pricing_catalog set unit_price` | D | D | D | D | **A — pending external verification** |
| 4 | `delete from pricing_catalog` | D | D | D | D | D (no grant, by design) |
| 5 | `select * from ballpark_sizing_reference` | D | see caveat† | A | A | A |
| 6 | `select * from rate_cards` | D | D | **D — preserved** | A | A |
| 7 | `update rate_cards` | D | D | D | D | A |
| 8 | `select * from vertical_labels` / `vertical_solutions` | A | A | A | A | A |
| 9 | write to vertical_labels / vertical_solutions | D | D | D | D | D (no grant, no app path) |
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
| 21 | `select * from quote_wbs_lines` / `quote_cost_items` | **preserved** | **preserved** | **D — preserved** | A | A |
| 22 | `select * from past_deployments` / `pricing_reviews` | record only | record only | record only | record only | record only |
| 23 | Sales rep attempts **direct or indirect approval of an owned quote** (e.g. `update quotes set state = 'approved'` on own row, or `transition_quote` straight to `approved`) | – | – | **D — denied by database transition enforcement** | – | – |

† Rows 1, 5 and 8: whether a Supabase anonymous Auth user reaches these
tables as `anon` or `authenticated` is unresolved. Migration C grants the
public lookups to both roles precisely so the intake picker works either
way; record which Postgres role the anon-session JWT actually resolves to.
Admin catalog writes (rows 2, 3) are asserted by the policies in Migration A
but **pending external verification** — no database inspection was performed
from this workspace.

Rows 10 and 11 are the **preserve-the-public-workflow** checks. If either
fails after applying the migrations, stop and roll back — the public
`/get-a-quote` flow is broken.

Row 18 is the **sales cannot approve** check. Its purpose has changed: the
live `public.enforce_quote_state_transition()` trigger function has been
inspected and verified to allow `under_review → approved` only for
`estimator` and `admin` — so this row now **verifies the existing
server-side control; no approval fix is being deployed**. Test through the
actual RPC/API path (real JWTs against PostgREST), not only the UI. Expected:
sales rep Deny, estimator Allow, admin Allow, external Deny. Row 23 covers
the direct/indirect path (a rep writing `state = 'approved'` on their own
quote outside the normal RPC flow) and must also be denied by the database
transition enforcement.

Row 21: quote_wbs_lines / quote_cost_items access is **preserved as
Estimator/Admin-only** in Phase 1A — nothing modifies it. Verify the claim
with VERIFY_phase_1a.sql section 8b and record the result as a Phase 1B
input.

Row 22: no change proposed in Phase 1A. Record the observed state.

## Execution notes

- Run each read/write with the target identity's JWT against PostgREST, not
  as a superuser in the SQL editor — the SQL editor bypasses RLS and will
  make every test look like "allow".
- For deny cases, accept either a `42501` permission error or an empty
  result set; record which one occurred, because a silent empty set from a
  missing grant looks the same as a correct policy denial.
- Capture the raw response for each cell. "It looked fine in the UI" is not
  a result — see the standing instruction above.
