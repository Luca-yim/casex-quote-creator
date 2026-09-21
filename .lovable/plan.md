# Proposal Totals: Recurring + NASPO + Contract Duration + Approval Snapshot

Plan only. No code, schema, policy, or data changes are made until this is approved.

## What exists today

**Two separate pricing paths**

- Ballpark path — `src/lib/calculation-engine/baseline-calculator.ts` (`calculatePricingBreakdown`). Already complete: builds catalog line items, splits them into one-time and monthly, computes `annualRecurring = monthly * 12`, applies contract years via `contract-tcv.ts` (`oneTime + monthly*12*years`), applies the repeatable-activation adjustment, then margin. NASPO is already handled here: `useNaspoDiscount = customerType === "state_naspo"` is passed into every line-item builder (`catalog-utils.toLineItem`, case-worker, B2C, support), which selects `naspo_discount_price ?? unit_price`.
- Proposal path — `src/features/pricing-sidebar/ProposalPricingBlock.tsx` calling `src/lib/pricing-engine/fullQuote.ts`. It computes only: `grandTotalCost(WBS lines + cost items)` → `totalImplementationFee(margin, cost, contingency)`. It has **no** recurring items, **no** catalog/NASPO pricing, and **never reads `contractYears`**. That single number is the Proposal price today.

**Contract duration** — `quotes.contract_years integer not null default 3`; Zod `z.number().int().min(1).max(10)` in `src/types/quote.ts:173`; edited in `src/features/intake/sections/CustomerInfoSection.tsx` (1–10 slider); mapped both directions in `src/features/intake/quote-mapper.ts`; included in the pipeline table, assumptions builder and, for Ballpark only, the PDF executive summary. It persists correctly through save/reload/duplication/promotion/version history because it is an ordinary quote column carried in the whole-quote JSON.

**Version model** — `quote_versions(quote_id, version_number, snapshot jsonb, change_reason, changed_by, changed_at)`, written by `src/lib/version-snapshot.ts`. The snapshot is the whole client-side `Quote` object plus a `__changeType` key. There is no computed-price snapshot of any kind. On approve, `src/features/intake/useQuoteTransition.ts` stamps `approved_at`/`approved_by`, calls `transition_quote`, then writes an `approve` snapshot of inputs only.

**Role protection** — client side via `canEdit` props; server side via `quotes_scoped()` (pricing columns stripped for unauthorized roles), `transition_quote` and the verified `enforce_quote_state_transition` trigger (estimator/admin only for approval). Whether `margin_percent`, `contingency_pct` and rate-card columns are protected against a direct rep UPDATE is still **unverified** — the live app database denies anon the whole public schema.

## Status table

| Area | Existing implementation | Required change | Files / database objects | Risk |
| --- | --- | --- | --- | --- |
| Proposal total | `fullQuote.totalImplementationFee` (labor cost + margin + contingency) | Compose implementation fee with catalog recurring + duration into a structured Proposal total | new `src/lib/pricing-engine/proposalTotal.ts`; `ProposalPricingBlock.tsx` | Medium — must not change the implementation-fee number itself |
| Recurring items | Only in the Ballpark engine | Reuse `calculatePricingBreakdown` for the Proposal's catalog side; do not re-implement | `baseline-calculator.ts` (read-only reuse), `ProposalPricingBlock.tsx`, `PricingSidebar.tsx` | Low |
| NASPO / price book | Ballpark only, per-SKU `naspo_discount_price` | Automatic on Proposal too via the same `customerType === "state_naspo"` flag; explicit on-screen and in-PDF callout | `catalog-utils.ts` (no change), `ProposalPricingBlock.tsx`, PDF summary | Low |
| Contract duration | Column, Zod 1–10, slider, mapper, persisted | No schema change. Feed it into the Proposal total and show it; add explicit int/step guard on the control | `CustomerInfoSection.tsx`, `types/quote.ts` (no change), `proposalTotal.ts` | Low |
| Approval snapshot | Inputs-only JSON in `quote_versions.snapshot` | Add a `__pricingSnapshot` object to the approve snapshot and read it back for approved quotes | `version-snapshot.ts`, `useQuoteTransition.ts`, `PricingSidebar.tsx`, version-history UI | **High** — `quote_versions_scoped()` strips known pricing keys; a new key may leak pricing to reps |
| PDF | Ballpark PDF prints recurring; Proposal PDF prints the implementation fee | Print one-time / annual recurring / multi-year / combined total, duration and NASPO callout for Proposal | `useQuotePdfDownload.ts`, `types.ts`, `PdfExecutiveSummary.tsx`, `PdfLineItemsPage.tsx` | Medium |
| Excel | Does not exist | Structure the totals object so an exporter can consume it. Not built now | `proposalTotal.ts` shape only | Low |
| Rep restrictions | Client `canEdit`; server unverified | Verify column-level protection before shipping; add a server guard if absent | `docs/phase-1a/`, quotes RLS/grants | High until verified |

## Total structure

The Proposal total becomes an object, not a single number:

```text
oneTimeSubtotal      = implementation fee (margin + contingency)  +  catalog one-time items
annualRecurring      = catalog monthly items x 12   (NASPO prices when applicable)
multiYearRecurring   = annualRecurring x contractYears
proposalTotal        = oneTimeSubtotal + multiYearRecurring
```

Margin is applied exactly once: the implementation fee already carries it; catalog recurring uses the existing Ballpark margin treatment. This has to be settled explicitly (see ambiguities) so no line is grossed up twice.

## Behaviour rules

- **Duration change** — recalculates live in draft/returned states only; recurring and multi-year lines recompute, the implementation fee does not.
- **States** — `draft`, `submitted_for_review`, `estimator_adjusted` (returned) recalculate live. `approved`, `sent_to_customer`, `accepted`, `declined` render the approval-time snapshot; if a live recompute differs, show an "inputs changed since approval" notice rather than silently moving the price.
- **NASPO** — automatic, no estimator override, per SKU, falls back to `unit_price` where `naspo_discount_price` is null, and always renders a visible callout.
- **Roles** — reps can see the Proposal total but cannot edit margin, contingency or rates; estimators/admins can. Approval remains estimator/admin.

## Files and database objects to change

Application: new `src/lib/pricing-engine/proposalTotal.ts`; `ProposalPricingBlock.tsx`; `PricingSidebar.tsx`; `useQuotePdfDownload.ts` + PDF `types.ts`, `PdfExecutiveSummary.tsx`, `PdfLineItemsPage.tsx`; `version-snapshot.ts`; `useQuoteTransition.ts`; `CustomerInfoSection.tsx`; fixtures and tests.

Database: **no migration required for duration or NASPO**. One possible change: `quote_versions_scoped()` must strip the new snapshot pricing key for unauthorized roles — that is a function replacement plus a rollback script, only if the current implementation whitelists rather than strips keys. This must be confirmed with service-role access before implementation.

## Tests

Unit: `proposalTotal` (one-time, annual, multi-year, combined, margin applied once, NASPO fallback, duration 1 and 10, zero-recurring). Integration: sidebar renders all four figures, live recompute on duration change, snapshot frozen after approval, rep sees no editable margin/contingency. DB: approval writes exactly one snapshot containing the pricing block; `quote_versions_scoped` hides it from a rep session. E2E: promote → price → approve → PDF shows the approved figures.

## Migration / rollback

No data migration. If the scoped-version function is changed, ship it with a rollback that restores the previous definition. Snapshot additions are additive JSON and old rows keep working.

## Ambiguities needing your decision

1. **Margin on recurring** — should catalog recurring items be grossed up by the Proposal margin, or billed at catalog/NASPO price with margin applied only to implementation? (Affects the total materially.)
2. **Contingency on recurring** — apply, or implementation-only?
3. **Snapshot scope** — freeze only totals, or the full line-item detail used at approval?
4. **Post-approval edits** — warn only, or block edits to pricing inputs once approved?
5. **Ballpark parity** — leave Ballpark untouched (current assumption), or align its headline with the new structure later?
6. **Rep visibility** — may a rep see the recurring breakdown before approval, or only the combined total?
