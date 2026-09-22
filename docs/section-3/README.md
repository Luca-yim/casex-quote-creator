# Section 3 — Q3.4 Billing Preference (design / migration package)

**Status: PREPARED, NOT APPLIED. Implementation has not started.**
No application code, generated types, tests, or database objects have been
changed. No SQL has been executed. Every file in this folder is review-only.

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
- Q3.4 Billing Preference — **not implemented** anywhere in the repository.

None of the completed work above is reopened, re-audited, or modified by this
package.

## 2. Q3.4 approved classification

Proposal-only; absent from Ballpark; absent from public lead intake; visible
to Sales Representatives, Estimators and Admins per the approved role model;
hidden from External users; optional for Proposal completion, submission and
approval; nullable persistence; no pricing-engine effect; no WBS, rate-card,
NASPO, margin, contingency, scoring or calculator effect. Options: Monthly,
Annual upfront, Annual quarterly, Other. Existing quotes stay valid with NULL.
Existing Ballpark behaviour is unchanged.

## 3. Repository evidence that the feature is absent

`rg -n -i "billing.?preference|billingPreference|annual.?upfront|annual.?quarterly"`
returns zero matches across the repository. Confirmed absent from:

- `src/types/quote.ts` (`Quote` interface lines 107–182; `quoteSchema` 198–367)
- `src/lib/database.types.ts` (quotes Row/Insert/Update; `quotes_scoped` Returns)
- `src/features/intake/IntakeForm.tsx` (section list, lines 154–172) and all 23
  files under `src/features/intake/sections/`
- `src/features/intake/quote-mapper.ts` (`rowToQuote` 15–87; `QUOTE_FIELD_COLUMNS` 90–136)
- `src/lib/quote-columns.ts` (external safe-column list, 17–57)
- `docs/section-1/*`, `docs/section-2/*` (no billing column in any RETURNS TABLE)
- `src/features/pdf-export/**`, all test files, all e2e specs

The only `monthly` / `payment` hits are unrelated: `src/types/pricing.ts:7`
(`PricingCategory`), the calculation-engine recurring-cost code, and
`src/server.ts:78` (`Permissions-Policy: payment=()`).

Reusable "Other" pattern found at `src/types/quote.ts:323–329` (Zod
`superRefine`) and `src/features/intake/sections/PricingScheduleSection.tsx:87–100`
(conditional detail input).

## 4. Proposed database changes

Two nullable `text` columns on `public.quotes`, no database default, no
backfill: `billing_preference` and `billing_preference_other_detail`. Two
guarded check constraints (`NOT VALID` → `VALIDATE`). Two masked outputs
appended to the end of `public.quotes_scoped()`'s explicit `RETURNS TABLE`.
`NOTIFY pgrst, 'reload schema'`. Nothing else.

**Separate `billing_preference_other_detail` column — required, yes.** The
approved options include "Other", and the repository's established and
already-approved pattern for every other "Other" option (`vertical`,
`geographic_scope`, `pricing_schedule`) is a dedicated sibling
`*_other_detail` text column plus a Zod `superRefine` rule. Overloading the
`billing_preference` column with free text would break the option check
constraint and diverge from the accepted pattern.

**Option values and labels** (stored snake_case, labels app-side, matching
`quote-metadata-options.ts` convention):

| Stored value | Label |
|---|---|
| `monthly` | Monthly |
| `annual_upfront` | Annual upfront |
| `annual_quarterly` | Annual quarterly |
| `other` | Other |

**"Annual quarterly" as default — OPEN DECISION (D2).** The draft carries **no
database default** and no UI preselection, on the grounds that Q3.4 is
optional and NULL must remain valid. Section 2's `pricing_schedule` took the
opposite route (a UI-only default materialised on mount) because it is
*required* before submission. Since Q3.4 is optional, defaulting it would
fabricate a commercial term the rep never chose. **Requires explicit
approval before implementation.**

**`quotes_scoped()` impact.** The function uses an explicit `RETURNS TABLE`
list, so the two outputs must be appended explicitly; they cannot appear
implicitly. Masking: values returned when `public.current_user_role()` is in
`('sales_rep','estimator','admin')`, otherwise NULL. Note this is *wider* than
`pricing_schedule_other_detail`, which is estimator/admin-only — Q3.4 is
rep-visible by the approved classification.

**`quote-columns.ts` impact.** `SAFE_QUOTE_COLUMNS` is the external
projection allow-list. The two Q3.4 columns must **not** be added to it, so
external users never request them over the wire. This is a deliberate
non-change to the list, and a test must lock it in.

**Write authorization — OPEN DECISION (D4).** The draft adds **no** trigger:
sales reps, estimators and admins may all write Q3.4, which is exactly the set
the existing `quotes` RLS policies already permit to update their rows; there
is no narrower rule to enforce. Section 2's trigger existed only because
`pricing_schedule` is estimator/admin-only. If review disagrees, the trigger
must be a separate, separately approved migration.

## 5. Migration safety requirements

Run `0_capture.sql` first and preserve its full output — it is the only valid
source for the `quotes_scoped()` restore in `2_rollback.sql`. Do not execute
`1_forward.sql` while any placeholder remains. Single transaction. No
`SELECT *`. No `DROP CASCADE`. Constraints added `NOT VALID` then validated.
No backfill and no default, so existing rows stay NULL and no lock-heavy
rewrite occurs. Preserve the captured owner, `SECURITY DEFINER`, `STABLE`,
language, `search_path`, and grant set exactly; never grant `EXECUTE` to
`anon` or `PUBLIC`; do not introduce a `service_role` grant. Leave the Section
2 authorization trigger and all `quotes` RLS policies untouched. Finish with a
PostgREST schema reload, then run `VERIFY.sql`.

## 6. Rollback requirements

`2_rollback.sql` restores the captured pre-change `quotes_scoped()` verbatim,
then drops the two Q3.4 constraints, then the two Q3.4 columns, without
`CASCADE`. It must not touch Section 1, Section 2, Q3.1a, Q3.2, the Section 2
trigger, RLS policies, or any unrelated object or data. Dropping the columns
is destructive to any values entered after the forward run — export them
first. Rollback is **not executable** until the live pre-change definition and
object inventory are pasted in. After rollback, re-run `0_capture.sql` and
diff against the pre-change baseline.

## 7. Exact repository implementation plan (future work, not done)

| File | Affected | Why / What changes | Must remain unchanged |
|---|---|---|---|
| `src/types/quote.ts` | Definitely | Add `BillingPreference` union type; add `billingPreference` and `billingPreferenceOtherDetail` to `Quote` (nullable); add both to `quoteSchema` as `.nullable().default(null)`; add a `superRefine` rule requiring detail when the value is `other` | Every existing field, all Section 1/2 rules, all existing `superRefine` branches |
| `src/features/intake/sections/quote-metadata-options.ts` | Definitely | Add a `BILLING_PREFERENCES` option array with the four stored values and labels | `OPPORTUNITY_STAGES`, `DEAL_*`, `GEOGRAPHIC_SCOPES`, `PRICING_SCHEDULES`, `pricingScheduleDefaultFor`, `QUOTE_VALIDITY_DEFAULT_DAYS` |
| New `src/features/intake/sections/BillingPreferenceSection.tsx` | Definitely | New Proposal-only section modelled on `PricingScheduleSection`, gated `quote.tier !== "proposal" || role === "external"` → return null; Select + conditional Other detail input; **no** mount-time default (pending D2) | n/a — new file |
| `src/features/intake/IntakeForm.tsx` | Definitely | Import and render the new section once, in Proposal order | Section order and all existing sections |
| `src/features/intake/quote-mapper.ts` | Definitely | Map both columns in `rowToQuote`; add both keys to `QUOTE_FIELD_COLUMNS` for autosave | All existing mappings |
| `src/lib/quote-columns.ts` | Definitely (as a deliberate non-addition) | Confirm and test that neither column joins `SAFE_QUOTE_COLUMNS` | The existing list contents |
| `src/lib/database.types.ts` | Definitely | Regenerated after the migration only — never hand-edited | Everything else in the file |
| `src/lib/quote-validation.ts`, `useQuoteTransition.ts`, `SubmitBar.tsx` | **Not** affected | Q3.4 is optional for completion, submission and approval, so no readiness or approval gate is added | All existing gates, including `assertPricingScheduleForApproval` |
| `src/features/pdf-export/**` | Potentially | Only if an approved customer-facing or internal output requirement exists. None found in the repository — excluded by default | All existing PDF pages and content |
| Tests | Definitely | New `section3-billing-preference.test.ts`; additions to `IntakeForm.test.tsx`, `LeadIntakeForm.test.tsx`, `e2e/external-visibility.spec.ts` | Existing Section 1/2 assertions |

## 8. Required repository tests

Proposal-only render; hidden for external; hidden on Ballpark
(`tier === "ballpark"`); absent from public lead intake; exactly the four
option values with the approved labels; "Other" reveals the detail input and
Zod rejects an empty detail; NULL is valid at submission and approval (no new
gate); round-trip persistence through `QUOTE_FIELD_COLUMNS` and `rowToQuote`;
`SAFE_QUOTE_COLUMNS` excludes both columns; pricing totals byte-identical
before and after; existing Section 1 (15) and Section 2 (23) suites still pass;
full suite shows only the three known pre-existing Ballpark-range failures.

## 9. Required live authenticated tests

`VERIFY.sql` Part B: estimator, admin and sales_rep sessions receive real
values from `quotes_scoped()`; external sessions receive NULL for both
columns; external PostgREST responses carry no billing values; writes succeed
for sales_rep/estimator/admin and are refused for external and anon; lead
conversion still yields NULL; Ballpark end-to-end unchanged. Static inspection
proves none of this — real sessions are required, and running as `postgres`
does not count.

## 10. Explicit exclusions

No change to: Ballpark forms, public lead intake, lead-conversion behaviour
(NULL compatibility verification only), pricing calculations, WBS, rate cards,
NASPO, margin, contingency, scoring, approval locks, snapshots, realtime,
Section 1, Section 2, Q3.1a, Q3.2, completed database security work, or
customer PDFs / Excel exports.

## 11. Open approval decisions

- **D1** — separate `billing_preference_other_detail` column. Draft: yes.
- **D2** — is "Annual quarterly" a UI default only, or persisted? Draft: no
  default at all, at either layer. **Unresolved; blocking.**
- **D3** — enforce the "Other" detail requirement in the database, or in Zod
  only as Q2.2/Q2.3 do? Draft: Zod only.
- **D4** — add a write-authorization trigger? Draft: no.
- **D5** — any PDF/export surface for Q3.4? Draft: none; no approved output
  requirement found in the repository.

## 12. Live database evidence still required

Before `1_forward.sql` can be finalised: the live `quotes_scoped()`
definition; its owner, volatility, security-definer status and search_path;
its output-column names, order and count; the current `public.quotes` columns;
current constraints; current grants; current RLS policies; current
non-internal triggers; current row count; and confirmation that no live
billing/invoice/payment column already exists. All are captured by
`0_capture.sql` and must be supplied by an authorized operator.

**Implementation has not started.**
