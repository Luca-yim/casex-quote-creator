# Phase 1A — Application compatibility report

All statements below are **confirmed from repository evidence** unless
marked otherwise. No database was inspected.

## 1. How catalog reads currently occur

All catalog-family reads go through the browser Supabase client
(`src/lib/supabase.ts` → `src/integrations/supabase/client.ts`) using the
signed-in user's JWT. There is no server-function or service-role read path
for pricing reference data.

| Table | Read site | Role at read time |
|---|---|---|
| `pricing_catalog` | `src/hooks/usePricingCatalog.ts:18` | authenticated |
| `pricing_catalog` | `src/features/pdf-export/useQuotePdfDownload.ts:88` | authenticated |
| `ballpark_sizing_reference` | `src/features/estimator-ballpark/useBallparkSizingReference.ts:30` | authenticated |
| `ballpark_sizing_reference` | `src/features/pdf-export/useQuotePdfDownload.ts:114` | authenticated |
| `rate_cards` | `src/features/wbs/useWbsData.ts:129` | authenticated (estimator/admin surface) |
| `phase_weight_allocation` | `src/features/wbs/useWbsData.ts:162` | authenticated |
| `vertical_labels` | `src/hooks/useVerticalLabels.ts:15` | **anonymous session** on the public intake |
| `vertical_solutions` | `src/hooks/useVerticalSolutions.ts:12` | **anonymous session** on the public intake |

Confidentiality of unit rates is currently an **application-layer
projection**, not a database control: `usePricingCatalog.ts` requests an
explicit safe column list and zeroes `unit_price` /
`naspo_discount_price` when `shouldHidePricingData(role)`
(`src/lib/quote-columns.ts`) is true. A hostile authenticated user can
bypass it with a direct PostgREST call today. `docs/SECURITY_HARDENING.sql`
section 2 already documents this gap and explains why column grants are not
a clean fix for a single `authenticated` role.

## 2. Which application functions call lead conversion

| RPC | Caller | Trigger in the UI |
|---|---|---|
| `claim_and_convert_lead(p_lead_id)` | `src/features/leads/useLeadActions.ts:34` | "Claim & convert" in `LeadRowActions.tsx`; navigates to the new quote |
| `convert_lead_to_quote(p_lead_id)` | `src/features/leads/useConvertLeadToQuote.ts:18` | "Convert to Ballpark" — now a narrow fallback, shown only for leads already `claimed` with no `converted_quote_id` |
| `estimator_assign_and_convert(p_lead_id, p_rep_id)` | `src/features/leads/useLeadActions.ts:70` | Estimator "Assign & claim" dialog |

All three are called with an authenticated JWT. None is reachable
anonymously in any code path.

## 3. Functions expected to be callable by anonymous users

**None.** Repository grep finds no `.rpc(...)` call on any anonymous path.
The single anonymous database interaction is table-level:

- `INSERT INTO public.lead_intakes` — `src/routes/get-a-quote.tsx:88`
- `SELECT lead_number FROM public.lead_intakes WHERE id = <just inserted>` —
  `src/routes/get-a-quote.tsx:118`

Both run under an anonymous Supabase session established after the
Turnstile gate. The session is signed out immediately after submission.
`vertical_labels` / `vertical_solutions` are also read by that session.

Migration B therefore revokes `anon` EXECUTE on every RPC, and migration C
explicitly preserves `anon` SELECT on the two lookup tables. Neither touches
`lead_intakes`.

## 4. Functions expected to be authenticated-only

`quotes_scoped`, `quote_versions_scoped`, `transition_quote`,
`convert_lead_to_quote`, `claim_and_convert_lead`,
`estimator_assign_and_convert`, `private.has_role`, and (for policy
evaluation) `current_user_role`.

Trigger-only functions must be callable by **nobody** over the API:
`handle_new_user`, `update_updated_at_column`, and the profile-protection
triggers in `docs/ADMIN_USER_MANAGEMENT.sql` /
`docs/SECURITY_HARDENING.sql`.

## 5. Do catalog writes exist in the client?

**No.** A repository-wide search for `.from("pricing_catalog")`,
`.from("rate_cards")`, `.from("ballpark_sizing_reference")` and
`.from("phase_weight_allocation")` returns reads only — no `insert`,
`update`, `upsert` or `delete`. Catalog maintenance is currently performed
out of band.

Consequence: migration A can close catalog writes to every non-admin
identity with **zero** application impact today. The admin-only write
policies exist so a future admin catalog editor needs no further grant
change.

## 6. Does current UI behaviour depend on direct table access?

Yes, in these places — each is a constraint on what Phase 1A may lock down:

| Surface | Direct table access | Impact if RLS is tightened wrongly |
|---|---|---|
| Lead queue | `lead_intakes` + two `profiles` joins (`useLeadQueue.ts:73`) | Queue empties for internal roles |
| Lead stats | `lead_intakes` (`useLeadStats.ts:32`) | Stat cards read zero |
| Lead actions (assign, status, duplicate) | `lead_intakes` UPDATE (`useLeadActions.ts:11`) | Those three actions fail |
| WBS editor | `rate_cards`, `phase_weight_allocation`, and WBS/cost tables | Estimator cannot build a Proposal |
| Public intake | `lead_intakes` INSERT + `vertical_*` SELECT | Public quote requests stop working |
| Quote reads | `quotes_scoped()` RPC, not the base table | Unaffected by table-level tightening, but depends on the RPC keeping `authenticated` EXECUTE |
| Quote writes | base `quotes` UPDATE (intake autosave) | Depends on existing quotes policies, untouched here |

## 7. Application changes required after RLS is enabled

**None are required by migrations A–D as written.** Every read path the
application uses is preserved, and no write path the application uses is
removed.

Two follow-ups, explicitly out of Phase 1A scope:

1. If the DBA decides to narrow `pricing_catalog` reads by role at the
   database level (rather than relying on the app-side projection), the
   external-user path in `src/hooks/usePricingCatalog.ts` must move to a
   `SECURITY DEFINER` projection function similar to `quotes_scoped()`.
   Do not narrow those reads without that change — the external dashboard
   needs SKU names and tier ranges.
2. If migration C's investigation item I-1 leads to RLS on
   `quote_wbs_lines` / `quote_cost_items`, `src/features/wbs/useWbsData.ts`
   must be re-tested end to end; it reads and writes those tables directly.

## 8. Conflicts found between the repository and itself

| # | Conflict | Why it matters |
|---|---|---|
| C-1 | `pricing_catalog.naspo_discount_price` is read by `src/hooks/usePricingCatalog.ts` but is absent from the generated types (`src/lib/database.types.ts:50`) | Either the types are stale or NASPO pricing fails at runtime. Verification section 11a resolves it. |
| C-2 | `profiles.role` is used by `docs/SECURITY_HARDENING.sql`, `docs/QUOTE_PDFS_INTERNAL_SCOPE.sql` and `docs/ADMIN_USER_MANAGEMENT.sql`, but roles live in `public.user_roles` and `profiles` has no `role` column in the generated types | Those scripts were likely never applied as written. The internal-PDF boundary may not exist. Verification section 11b resolves it. |
| C-3 | `docs/*.sql` call `public.has_role(...)`, which was dropped in `supabase/migrations/20260820193207_*.sql` in favour of `private.has_role` | Any live policy still carrying that expression errors at evaluation time. Verification section 7 resolves it. |
| C-4 | The three lead-conversion RPCs and `transition_quote` exist in the generated types but in no repository migration | Their bodies, roles checks and `search_path` are unknown. Verification section 5 is the only way to review them. |
