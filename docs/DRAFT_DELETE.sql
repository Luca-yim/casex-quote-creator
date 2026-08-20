-- Phase 3: draft deletion
-- Run once in the SQL editor. Deletion is deliberately narrow: only the
-- requester (or an admin) may delete, and only a draft that has never been
-- submitted for review. Anything an estimator has seen stays in the audit
-- trail and must be archived through the workflow instead.

-- 1. Dependent rows must disappear with the draft, otherwise the delete fails
--    with a foreign-key violation (23503).
alter table public.quote_versions
  drop constraint if exists quote_versions_quote_id_fkey,
  add constraint quote_versions_quote_id_fkey
    foreign key (quote_id) references public.quotes(id) on delete cascade;

alter table public.quote_pdfs
  drop constraint if exists quote_pdfs_quote_id_fkey,
  add constraint quote_pdfs_quote_id_fkey
    foreign key (quote_id) references public.quotes(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_quote_id_fkey,
  add constraint notifications_quote_id_fkey
    foreign key (quote_id) references public.quotes(id) on delete cascade;

-- 2. Delete policy.
drop policy if exists "Requester can delete unsubmitted drafts" on public.quotes;
create policy "Requester can delete unsubmitted drafts"
on public.quotes
for delete
to authenticated
using (
  state = 'draft'
  and submitted_at is null
  and (
    requested_by = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  )
);

-- 3. Grant (no-op if DELETE was already granted).
grant delete on public.quotes to authenticated;

-- 4. Verify: should return only your own unsubmitted drafts.
-- select id, name, state, submitted_at from public.quotes
--   where state = 'draft' and submitted_at is null and requested_by = auth.uid();
