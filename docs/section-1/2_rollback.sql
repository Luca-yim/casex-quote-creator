-- Section 1 — Quote Metadata: ROLLBACK. DO NOT APPLY WITHOUT REVIEW.
-- Dependency-safe order: restore the read path FIRST, then drop the columns.
-- Dropping the columns while a RETURNS TABLE function still lists them would
-- leave that function erroring on every call.

begin;

-- ---------------------------------------------------------------------------
-- 1. Restore public.quotes_scoped() to its exact prior definition
-- ---------------------------------------------------------------------------
-- Required ONLY if 1_forward.sql case 2b was executed. If the function returns
-- `setof public.quotes` (case 2a), it was never altered — skip to step 2 and it
-- reverts automatically when the columns are dropped.
--
-- Paste the stored output of 0_capture.sql §0.2 verbatim below, then re-apply
-- the owner from §0.1 and the exact grant set from §0.3.

-- --- BEGIN case-2b block
-- drop function public.quotes_scoped();
--
-- <<< paste pg_get_functiondef output from 0_capture.sql §0.2, unmodified >>>
--
-- alter function public.quotes_scoped() owner to <<< captured owner, §0.1 >>>;
-- revoke all on function public.quotes_scoped() from public;
-- grant execute on function public.quotes_scoped() to authenticated;
-- grant execute on function public.quotes_scoped() to service_role;
-- -- plus any additional grantee captured in §0.3, and only those.
-- --- END case-2b block

-- ---------------------------------------------------------------------------
-- 2. Drop the constraints, then the columns
-- ---------------------------------------------------------------------------
alter table public.quotes
  drop constraint if exists quotes_opportunity_stage_check,
  drop constraint if exists quotes_deal_priority_check,
  drop constraint if exists quotes_deal_template_check;

alter table public.quotes
  drop column if exists opportunity_stage,
  drop column if exists deal_priority,
  drop column if exists deal_template,
  drop column if exists quote_validity_date;

-- No CASCADE: if the drop fails on a dependency, the transaction rolls back
-- and the dependency must be resolved deliberately rather than silently
-- dropped.

commit;

-- After commit:
--   notify pgrst, 'reload schema';
--
-- Application side: rolling the columns back requires reverting the Section 1
-- application commit as well, otherwise reads/writes reference missing columns.
