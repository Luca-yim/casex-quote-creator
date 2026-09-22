# Section 3 — Q3.4 Billing Preference (design / migration package)

**Status: IMPLEMENTATION PREPARED — repository code and migration package
complete; the live migration has NOT been applied.** Application code,
generated types and tests now implement Q3.4. `1_forward.sql` and
`2_rollback.sql` remain drafts: an authorized operator must review them
against a fresh `0_capture.sql` run before applying. No SQL has ever been
executed against the live database from this repository.

## 1. Current verified project state

- Proposal implementation audit — complete.
- Section 1 (Quote Metadata) — complete, migrated, verified, accepted.
- `public.current_user_role()` privilege hardening — applied and verified.
- Section 2 (`geographic_scope`, `geographic_scope_other_detail`,
  `pricing_schedule`, `pricing_schedule_other_detail`) — complete: structural
  verification, constraints, authenticated role tests, PostgREST/application
  behaviour, and Ballpark / lead-conversion compatibility all passed.
- Q3.1a and Q3.2 — fully implemented per the completed separation plan.
- Questionnaire Separation and Field Ownership Plan — complete and
  authoritative; not recreated here.
- Q3.4 Billing Preference — **not implemented** in the repository and **not
  present in the live database**.

None of the completed work above is reopened, re-audited, or modified.

## 1b. Live database capture — **COMPLETE**

Captured by an authorized operator via `0_capture.sql`. This is the newer
verified fact set for Q3.4 work. (The historical State of Play statement about
18 rows holding NULL Section 2 values is preserved as written and is not
rewritten; the current live count below applies to this package only.)

| Fact | Captured value |
|---|---|
| `public.quotes` column count | 60 |
| `public.quotes` row count (`quote_count`) | **13** |
| Billing Preference column | absent |
| Billing Preference Other-detail column | absent |
| Billing Preference constraint | absent |
| Q3.4 name collisions (constraint / trigger) | none |
| `quotes_scoped()` output columns | exactly 60 |
| Output position 57 | `geographic_scope` |
| Output position 58 | `geographic_scope_other_detail` |
| Output position 59 | `pricing_schedule` |
| Output position 60 | `pricing_schedule_other_detail` |
| `quotes_scoped()` security | SECURITY DEFINER |
| `quotes_scoped()` volatility | STABLE |
| `quotes_scoped()` language | SQL |
| `quotes_scoped()` owner | `postgres` |
| `quotes_scoped()` search_path | `public` |
| `quotes_scoped()` grants | EXECUTE for `authenticated` observed |
| Section 2 constraints | present and validated |
| Section 2 authorization trigger | present; must remain behaviourally unchanged |
| Non-internal triggers on `public.quotes` | `enforce_quote_state`, `notify_quote_reassignment`, `notify_quote_state_change`, `quotes_enforce_pricing_schedule_authorization`, `quotes_updated_at` |
| RLS policies on `public.quotes` | include External draft updates, Sales Representative owned-quote updates, and Estimator/Admin update paths |

**Consequence for Q3.4:** adding nullable Q3.4 column(s) with **no default and
no backfill** must leave all **13** existing rows NULL for those columns. Every
existing quote therefore remains valid. `VERIFY.sql` check A2 asserts this.

**Authoritative pre-change function definition.** The supplied
`quotes_scoped()` definition is the authoritative rollback baseline. Its
verbatim body is held in the operator's capture output and is deliberately
**not** reproduced in this repository, so that no repository copy can drift
from live and be pasted over the live function by mistake. `1_forward.sql` §4
and `2_rollback.sql` §1 carry paste placeholders that must be filled from the
capture output at execution time.

**Append rule.** All 60 existing output columns and their order are preserved
exactly. Any Q3.4 output is appended **only after position 60**, starting at
position 61. No insertion, reordering, or removal is permitted.

## 2. Q3.4 approved classification

Proposal-only; absent from Ballpark; absent from public lead intake; visible
to Sales Representatives, Estimators and Admins per the approved role model;
hidden from External users; optional for Proposal completion, submission and
approval; nullable persistence; no pricing-engine effect; no WBS, rate-card,
NASPO, margin, contingency, scoring or calculator effect. Intended options:
Monthly, Annual upfront, Annual quarterly, Other. Existing quotes stay valid
with NULL. Existing Ballpark behaviour is unchanged.

## 3. Repository evidence that the feature is absent

`rg -n -i "billing.?preference|billingPreference|annual.?upfront|annual.?quarterly"`
returns zero matches repository-wide. Confirmed absent from:

- `src/types/quote.ts` (`Quote` interface 107–182; `quoteSchema` 198–367)
- `src/lib/database.types.ts` (quotes Row/Insert/Update; `quotes_scoped` Returns)
- `src/features/intake/IntakeForm.tsx` (section list 154–172) and all 23 files
  under `src/features/intake/sections/`
- `src/features/intake/quote-mapper.ts` (`rowToQuote` 15–87; `QUOTE_FIELD_COLUMNS` 90–136)
- `src/lib/quote-columns.ts` (external safe-column list 17–57)
- `docs/section-1/*`, `docs/section-2/*`
- `src/features/pdf-export/**`, all test files, all e2e specs

Unrelated hits only: `src/types/pricing.ts:7` (`PricingCategory`), the
calculation-engine recurring-cost code, `src/server.ts:78`
(`Permissions-Policy: payment=()`).

Reusable "Other" pattern: `src/types/quote.ts:323–329` (Zod `superRefine`) and
`src/features/intake/sections/PricingScheduleSection.tsx:87–100` (conditional
detail input).

## 4. Proposed database changes (shape only — not approved)

Nullable `text` column(s) on `public.quotes`, no database default, no
backfill; guarded check constraint(s) added `NOT VALID` then validated;
Q3.4 output(s) appended to `quotes_scoped()` after position 60;
`NOTIFY pgrst, 'reload schema'`. Nothing else.

Approved and now written concretely into `1_forward.sql`: two nullable text
columns (`billing_preference`, `billing_preference_other_detail`), no database
default, no backfill; the option constraint over exactly `monthly`,
`annual_upfront`, `annual_quarterly`, `other`; the Other-detail constraint
requiring a nonblank (`btrim`) detail only when the preference is `other`;
a separate `enforce_billing_preference_authorization()` trigger function with
trigger `quotes_enforce_billing_preference_authorization` (BEFORE INSERT OR
UPDATE); and a 62-output `quotes_scoped()` preserving positions 1–60 and the
captured masking byte-for-byte, appending `billing_preference` (61) and
`billing_preference_other_detail` (62) with role-aware masking.

**`quotes_scoped()` impact.** The function uses an explicit `RETURNS TABLE`
list of 60 columns, so any Q3.4 output must be appended explicitly; it cannot
appear implicitly. Positions 1–60 are preserved byte-for-byte, as are
SECURITY DEFINER, STABLE, SQL language, owner `postgres`, `search_path =
public`, and the captured grant set (EXECUTE for `authenticated`; never anon
or PUBLIC; no service_role grant added).

**`quote-columns.ts` impact.** `SAFE_QUOTE_COLUMNS` is the external
projection allow-list. Q3.4 column(s) must **not** be added to it, so external
users never request them over the wire. This deliberate non-change must be
locked in by a repository test.

**Trigger impact.** The live capture shows five non-internal triggers. All
five must remain present and behaviourally unchanged, in particular
`quotes_enforce_pricing_schedule_authorization`, whose function body hash is
asserted unchanged by `VERIFY.sql` S2-3b.

**External-write resolution.** The capture confirmed an External draft-update
RLS path exists, so RLS alone does NOT keep external users away from the Q3.4
columns. The approved resolution is the separate Q3.4 authorization trigger:
external writes to either field raise SQLSTATE 42501 on their own draft rows,
server-side. The existing `quotes` RLS policies are untouched.

## 5. Migration safety requirements

Re-run `0_capture.sql` immediately before any execution and confirm no drift
from §1b. Do not execute `1_forward.sql` while any placeholder remains.
Single transaction. No `SELECT *`. No `DROP CASCADE`. Constraints added
`NOT VALID` then validated. No backfill and no default, so all 13 existing
rows stay NULL and no table rewrite occurs. Preserve the captured owner,
security mode, volatility, language, search_path and grant set exactly. Leave
Section 2 constraints, the Section 2 trigger, the other four triggers, and all
`quotes` RLS policies untouched. Finish with a PostgREST schema reload, then
run `VERIFY.sql` Part A followed by Part B under real sessions.

## 6. Rollback requirements

`2_rollback.sql` restores the captured pre-change `quotes_scoped()` verbatim
(60 outputs, positions 57–60 as captured), then drops the Q3.4 constraint(s),
then the Q3.4 column(s), without `CASCADE`, returning `public.quotes` to its
captured 60-column shape. It must not touch Section 1, Section 2, Q3.1a,
Q3.2, the five live triggers, RLS policies, or any unrelated object or data.
Dropping the columns destroys any values entered after the forward run —
export them first. The pre-change capture output must be preserved; without it
the rollback has no valid source for the function body and must not be run.
After rollback, re-run `0_capture.sql` and diff against the §1b baseline.

## 7. Exact repository implementation plan (future work, not done)

| File | Affected | Why / What would change | Must remain unchanged |
|---|---|---|---|
| `src/types/quote.ts` | Definitely | Add the Q3.4 union type; add nullable field(s) to `Quote`; add them to `quoteSchema` as `.nullable().default(null)`; add an "Other" `superRefine` rule if approved | All existing fields, all Section 1/2 rules, all existing `superRefine` branches |
| `src/features/intake/sections/quote-metadata-options.ts` | Definitely | Add the Q3.4 option array once values are approved | `OPPORTUNITY_STAGES`, `DEAL_*`, `GEOGRAPHIC_SCOPES`, `PRICING_SCHEDULES`, `pricingScheduleDefaultFor`, `QUOTE_VALIDITY_DEFAULT_DAYS` |
| New `src/features/intake/sections/BillingPreferenceSection.tsx` | Definitely | New Proposal-only section modelled on `PricingScheduleSection`; returns null unless `quote.tier === "proposal"` and the role is permitted; Select plus conditional Other detail input; default behaviour pending approval | n/a — new file |
| `src/features/intake/IntakeForm.tsx` | Definitely | Import and render the new section once | Section order and all existing sections |
| `src/features/intake/quote-mapper.ts` | Definitely | Map the column(s) in `rowToQuote`; add key(s) to `QUOTE_FIELD_COLUMNS` for autosave | All existing mappings |
| `src/lib/quote-columns.ts` | Definitely (deliberate non-addition) | Confirm and test that Q3.4 column(s) never join `SAFE_QUOTE_COLUMNS` | The existing list contents |
| `src/lib/database.types.ts` | Definitely | Column entries added consistently with the final schema; regenerated properly by the platform once the migration is applied | Everything else |
| `src/lib/quote-validation.ts`, `useQuoteTransition.ts`, `SubmitBar.tsx` | **Not** affected | Q3.4 is optional for completion, submission and approval, so no readiness or approval gate is added | All existing gates, including `assertPricingScheduleForApproval` |
| `src/features/pdf-export/**` | Potentially | Only if an approved output requirement exists; none found. Held open as a decision | All existing PDF pages and content |
| Tests | Definitely | New `section3-billing-preference.test.ts`; additions to `IntakeForm.test.tsx`, `LeadIntakeForm.test.tsx`, `e2e/external-visibility.spec.ts` | Existing Section 1/2 assertions |

## 8. Required repository tests

Proposal-only render; hidden for External; hidden on Ballpark
(`tier === "ballpark"`); absent from public lead intake; exactly the approved
option values and labels; "Other" reveals the detail input and validation
behaves as approved; NULL is valid at submission and approval (no new gate);
round-trip persistence through `QUOTE_FIELD_COLUMNS` and `rowToQuote`;
`SAFE_QUOTE_COLUMNS` excludes the column(s); pricing totals byte-identical
before and after; existing Section 1 (15) and Section 2 (23) suites still
pass; full suite shows only the three known pre-existing Ballpark-range
failures.

## 9. Required live authenticated tests

`VERIFY.sql` Part B: estimator, admin and sales_rep sessions read real values
per the approved timing rule; external sessions receive NULL; external
PostgREST responses carry no billing values; writes behave as approved for
each role, with the External draft-update path tested explicitly rather than
assumed blocked; lead conversion still yields NULL; Ballpark end-to-end
unchanged; Section 2 role behaviour unregressed. Static inspection proves none
of this, and running as `postgres` does not count.

## 10. Explicit exclusions

No change to: Ballpark forms, public lead intake, lead-conversion behaviour
(NULL compatibility verification only), pricing calculations, WBS, rate cards,
NASPO, margin, contingency, scoring, approval locks, snapshots, realtime,
Section 1, Section 2, Q3.1a, Q3.2, completed database security work, or
customer PDFs / Excel exports.

## 11. Approval decisions — **resolved by the approved Q3.4 slice**

All eight previously open decisions were settled by the approved
implementation instructions and are baked into `1_forward.sql`:

- **D1 — resolved YES.** A separate `billing_preference_other_detail` column
  exists, following the established Q2.2/Q2.3 pattern.
- **D2 — resolved.** Stored values are exactly `monthly`, `annual_upfront`,
  `annual_quarterly`, `other` (labels: Monthly, Annual upfront, Annual
  quarterly, Other).
- **D3 — resolved persisted.** `annual_quarterly` is a real stored value;
  there is still NO default at the UI or database layer — the Proposal UI
  starts blank and never auto-persists a value on mount.
- **D4 — resolved, state-gated.** Sales Representatives may read and write
  the fields only on their OWN quote, and only in the states the existing
  lifecycle treats as editable (`canEditQuote` for `sales_rep`: `draft` or
  `estimator_adjusted`). Unowned quotes: never. This mirrors the existing
  `canEditIntake` implementation; no second lifecycle was invented.
- **D5 — resolved, trigger-enforced.** External users can never insert or
  update either field (SQLSTATE 42501), including on their own drafts via the
  External draft-update RLS path. Enforced server-side by the new trigger.
- **D6 — resolved, separate trigger.** `quotes_enforce_billing_preference_
  authorization` is new and independent; the Section 2 trigger and its
  function are not modified (verified by `VERIFY.sql` A9).
- **D7 — resolved, database-level.** Both the Zod layer and the database
  enforce the required nonblank Other detail (unlike Q2.2/Q2.3, where the
  database stays silent).
- **D8 — resolved none.** No approved PDF/export output target exists in the
  repository, so output code is unchanged.

## 12. Live database evidence status

Capture **complete** — see §1b. The captured 60-output `quotes_scoped()`
baseline (verified position-by-position against the live capture) is now
reproduced in `2_rollback.sql` §4 as the pre-change rollback definition, and
in `1_forward.sql` §4 as the 62-output post-change definition. The operator
must still re-run `0_capture.sql` immediately before applying and confirm no
drift; if the live function has drifted since the capture, STOP and
re-baseline rather than overwrite.

**Q3.4 repository implementation complete — live migration NOT applied.**
