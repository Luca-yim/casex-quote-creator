-- Session 5b — permission model tightening.
-- Run this against the CaseX Supabase project.

-- Change 1: estimators no longer see quotes claimed by another estimator.
drop policy if exists "estimators_see_all_submitted" on public.quotes;

create policy "estimators_see_actionable" on public.quotes
  for select to authenticated
  using (
    current_user_role() = 'estimator'
    and state != 'draft'
    and (state != 'under_review' or owner_id = auth.uid())
  );

-- Change 2: estimators cannot edit quotes that are out with a rep.
drop policy if exists "estimators_update_actionable" on public.quotes;

create policy "estimators_update_actionable" on public.quotes
  for update to authenticated
  using (
    current_user_role() = 'estimator'
    and state in ('submitted_for_review', 'under_review')
  )
  with check (current_user_role() = 'estimator');

-- Change 4: soft auto-routing column.
alter table public.quotes
  add column if not exists last_reviewed_by uuid
  references public.profiles(id) on delete set null;

create index if not exists quotes_last_reviewed_by_idx
  on public.quotes(last_reviewed_by);

-- Change 3: remove the estimator_adjusted -> approved shortcut from the state
-- transition trigger. Print the current definition first, then re-create it
-- with ONLY that pair removed (keep every other allowed transition):
--
--   select p.proname, pg_get_functiondef(p.oid)
--   from pg_trigger t
--   join pg_proc p on p.oid = t.tgfoid
--   join pg_class c on c.oid = t.tgrelid
--   where c.relname = 'quotes' and not t.tgisinternal;
--
-- In the re-created function delete the branch that allows
--   old.state = 'estimator_adjusted' and new.state = 'approved'
-- for the estimator/admin roles. Everything else stays as-is.
