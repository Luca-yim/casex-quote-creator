# Section 1 — Quote Metadata migration safety review

Status: **NOT APPLIED. No database object, policy, grant, production row, or
deployment was changed.** The build environment can only reach the Lovable
Cloud project, which exposes `profiles` and `user_roles` only. The application
database (which owns `quotes` and `quotes_scoped`) is not reachable from here,
so the live definition could not be dumped. Every statement below is written
to be run by an operator who dumps the live definition first.

## A. Pre-change object identity

`public.quotes_scoped` is **not a view**. It is a **read-only SECURITY DEFINER
set-returning function** taking no arguments, called from the client as
`supabase.rpc("quotes_scoped")`.

Repository evidence:
- `src/features/quotes/useMyQuotes.ts:36-41`, `src/features/review/useReviewQueue.ts:25-30`
  — `// NOTE: quotes_scoped() is SECURITY DEFINER and therefore bypasses RLS` +
  `.rpc("quotes_scoped")`.
- `src/lib/database.types.ts` — declared under `Functions` with
  `Args: Record<PropertyKey, never>`; the row shape is mirrored under `Views`
  purely as a type alias. Doc comment: *"returning `setof public.quotes` with
  pricing columns nulled out for roles that must not see them. SECURITY
  DEFINER: it bypasses RLS, so its WHERE clause must be kept in sync with the
  RLS policies on `quotes`."*
- `docs/PER_INTEGRATION_COMPLEXITY.sql:17-43` — the established procedure for a
  new `quotes` column: dump `pg_get_functiondef`, `DROP FUNCTION`, recreate
  byte-for-byte with the column appended, **re-apply grants** (DROP FUNCTION
  discards them), then `notify pgrst, 'reload schema'`.

Because it is a function, there is no security-barrier setting and no view
owner to preserve — the relevant properties are: security mode (DEFINER),
function owner, `search_path`, volatility, and EXECUTE grants
(`authenticated`, `service_role`).

**The previously proposed `CREATE OR REPLACE VIEW public.quotes_scoped ...
SELECT *` is withdrawn.** It targeted the wrong object class, would have
duplicated columns, and would have discarded the role-based nulling and the
ownership/sales-rep filter. It must not be run.

## Operator step 0 — capture the live definition (required)

Run `0_capture.sql` and store its output verbatim. `2_rollback.sql` cannot be
completed without it.

## Files

| File | Purpose |
| --- | --- |
| `0_capture.sql` | Dump definition, owner, security mode, config, grants, dependencies |
| `1_forward.sql` | Add the four columns; conditional function recreation |
| `2_rollback.sql` | Restore prior function, drop the four columns |
| `VERIFY.sql` | Post-change verification queries |

## Order

1. `0_capture.sql` (read-only) — paste the captured definition into
   `1_forward.sql` §2b and `2_rollback.sql` §1.
2. `1_forward.sql`.
3. `notify pgrst, 'reload schema';` then wait 30-60s.
4. `VERIFY.sql` as each role.

Phase 1A objects (`docs/phase-1a/`) are not referenced, modified, or reordered
by any statement here.
