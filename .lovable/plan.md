# Section 2 migration package — correction proposal (nothing applied)

The live capture shows `private.has_role` does not exist in this database. The prepared
`docs/section-2/1_forward.sql` trigger depends on it, so the package is not applicable as written.
No workaround helper will be created and no live object will be touched.

## Verified authorization primitives

Evidence from the capture and repository:

- `public.current_user_role()` — **verified to exist**: the live captured `public.quotes_scoped()`
  body calls it for margin masking and for every role branch of the WHERE clause. It returns the
  caller's role as text (`'external' | 'sales_rep' | 'estimator' | 'admin'`).
- `private.has_role(uuid, app_role)` — appears only in a repository migration file
  (`supabase/migrations/20260820193207_*.sql`); capture query 6 returned **no rows**, so it is not
  present in the live application database. Treated as non-existent.
- `public.has_role(uuid, app_role)` — referenced by older repository docs, but not confirmed by the
  live capture. Not used.

Conclusion: `public.current_user_role()` is the only role primitive verified against the live
database, and it fully supports the required Estimator/Admin-only write rule. No new role function
is needed, so item 8 (no new role functions) is satisfied.

## Correction

Replace the trigger's role test only. Everything else in the package stays byte-identical.

Current (unverified dependency):

```sql
IF NOT (private.has_role(auth.uid(), 'estimator')
        OR private.has_role(auth.uid(), 'admin')) THEN
```

Revised (verified primitive):

```sql
IF public.current_user_role() IS DISTINCT FROM 'estimator'
   AND public.current_user_role() IS DISTINCT FROM 'admin' THEN
```

The service-context pass-through (`auth.uid() IS NULL`) and the `42501` error stay unchanged, so a
NULL role from `current_user_role()` for an authenticated caller still denies the write.

### Precise diff from the prepared package

`docs/section-2/1_forward.sql`
- Section 3 header comment: dependency named as `public.current_user_role()` instead of
  `private.has_role`.
- Body of `public.enforce_pricing_schedule_authorization()`: the two-line `private.has_role`
  condition replaced by the `public.current_user_role()` condition above. Function signature,
  language, `SET search_path TO public`, trigger name, timing (`BEFORE UPDATE ... FOR EACH ROW`)
  unchanged.
- No other line changes: columns, guarded check constraints, the `quotes_scoped()` DROP + CREATE,
  masking, ownership filters, owner, grants, and `NOTIFY pgrst` are untouched.

`docs/section-2/0_capture.sql`
- Query 6 changed from probing `private.has_role` to asserting `public.current_user_role()` exists
  with its security mode, owner and grants — the dependency the forward script actually uses.

`docs/section-2/2_rollback.sql`
- No functional change. Only the comment naming the dropped trigger's dependency is corrected.

`docs/section-2/VERIFY.sql`
- Check 9 extended: confirm the trigger exists **and** that its function body references
  `public.current_user_role()` and contains no `has_role` reference.

`docs/section-2/README.md`
- Dependency description updated to `public.current_user_role()`, with a note recording why
  `private.has_role` was rejected.

## Preserved (unchanged by this correction)

- `quotes` RLS policies: untouched.
- `public.quotes_scoped()`: explicit RETURNS TABLE, SECURITY DEFINER, STABLE, SQL, owner postgres,
  `search_path = public`, existing masking and ownership filters.
- Section 1 output columns and behaviour.
- Section 2 additions only: `geographic_scope`, `geographic_scope_other_detail`,
  `pricing_schedule`, `pricing_schedule_other_detail`.
- `pricing_schedule_other_detail` remains estimator/admin-only in `quotes_scoped()` — NULL for sales
  reps, external users and anonymous callers.

## How the revised authorization path is verified

Before any application (separate approval), in this order:

1. Re-run `0_capture.sql`; query 6 must return exactly one `public.current_user_role()` row.
2. After a forward run in a non-production copy, run `VERIFY.sql`: trigger present, function body
   references `public.current_user_role()`, no `has_role` reference.
3. Role probes on a throwaway quote row: estimator and admin sessions can set `pricing_schedule`;
   sales_rep and external sessions receive `42501`; service context still writes.
4. Read probes: `quotes_scoped()` returns NULL `pricing_schedule_other_detail` for sales_rep and
   external; `pricing_schedule` visible to a sales rep only post-approval on owned quotes.
5. Confirm captured RLS policy list and `quotes_scoped()` properties match the pre-migration
   baseline.

## Confirmation

No migration was applied. No live database object was created, altered or dropped. No code, schema,
policy, configuration or data has been modified — this is a proposal only. Section 3 not started.
