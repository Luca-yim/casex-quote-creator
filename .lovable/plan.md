# UAT blockers: diagnosis and fix plan

## Shared root cause (all three bugs)

The last commit `3380057 "Hardened security + role fix"` changed the quote read key to include the role:

- `src/features/intake/useQuote.ts:15` → `queryKey: ["quote", quoteId, role]`

Every writer still writes the **old two-part key**:

- `src/features/intake/IntakePage.tsx:59` — optimistic field echo → `["quote", quoteId]`
- `src/features/intake/useDebouncedSave.ts:59` — auto-save result → `["quote", quote.id]`
- `src/features/intake/useSubmitQuote.ts:49`
- `src/features/intake/useQuoteTransition.ts:153`
- `src/features/intake/useQuote.ts:82` (draft create)

Since the keys no longer match, no write ever lands in the cache entry the page reads. Nothing re-renders until a hard refetch. This single mismatch produces the reported symptoms.

## Bug 3 — state changes but UI doesn't update (Step B)

Failing step: **B (key mismatch)**. `useQuoteTransition.onSuccess` calls `setQueryData(["quote", id])` and invalidates `["quotes"]` — neither touches `["quote", id, role]`. The DB transition succeeds, the page keeps the stale row until refresh. Realtime sync only updates dashboard list caches, not the detail cache, so it can't cover for it either.

Fix: centralize the key in one helper (`quoteQueryKey(id, role)` or drop `role` from the key and namespace it elsewhere) and use it in the query plus all five writers. Simplest correct option: keep role in the key, export the helper from `useQuote.ts`, and have writers invalidate `["quote", id]` as a **prefix** (`invalidateQueries({ queryKey: ["quote", id] })`) in addition to setting exact data — prefix invalidation matches regardless of role suffix. Also add `["quotes", "review-queue"]` prefix invalidation (already covered by `["quotes"]`).

## Bug 1 — progress indicator stuck (case (a))

Progress is **not** read from react-hook-form at all. `PricingSidebar.tsx:66` calls `readinessCheck(quote)` on the persisted quote from `useIntake()`, which comes from the query cache. `IntakeForm` does write every change through `updateField`, which is meant to echo optimistically into the cache — but that echo writes the wrong key (above), so the sidebar never sees a keystroke. Same for TCV, assumptions, and readiness.

Fix: same key fix restores live updates through the existing optimistic echo (no `useWatch` refactor needed, and it keeps a single source of truth). Additional correctness fix in the echo: `updateField` writes `{ ...current, [path]: value }` using the raw form path, which is already camelCase and matches `Quote`, so this stays as-is.

## Bug 2 — estimator margin change errors

Two distinct problems, both client-side:

1. The slider is bound to `quote.marginPercent` from the same broken cache entry, so it snaps back to the saved value while dragging.
2. There is **no app-side gate**: `PricingSidebar` calls `updateField("marginPercent", v)` for any value 10–30. Dragging to e.g. 12% with an empty justification sends the write straight to Postgres, which rejects it with the `margin_justification_required` check constraint (`23514`) → the error toast the estimator sees. The text under the textarea is warning copy only.

Fix (client-only, no migration expected):
- Hold slider position in local state, commit on release (`onValueCommit`) — with the cache fix, the displayed value stays correct.
- Block the write when the committed margin is outside 15–25 and justification is blank: keep the slider value visible, show the inline error, and defer the save until justification is entered (auto-save fires the pending margin once the justification is non-empty).
- Keep >30 / <10 impossible via slider bounds.

If, after the cache fix, the console shows an error whose message is *not* the `margin_justification_required` constraint, I will report the exact payload/status before changing anything else. I cannot inspect this database directly (external Supabase project), so **no SQL is proposed yet**; if the constraint definition turns out to be inverted, I'll hand you the exact `ALTER TABLE` text then.

## File changes

Step 1 (Bug 3): `src/features/intake/useQuote.ts` (export key helper), `useQuoteTransition.ts`, `useDebouncedSave.ts`, `useSubmitQuote.ts`, `IntakePage.tsx`.
Step 2 (Bug 1): verification only — covered by Step 1; adds a regression test asserting the optimistic echo lands on the key the page reads.
Step 3 (Bug 2): `src/features/pricing-sidebar/PricingSidebar.tsx` (local slider state + pre-save justification gate), small helper reuse from `src/lib/quote-validation.ts`.

Each step is verified separately before moving to the next.
