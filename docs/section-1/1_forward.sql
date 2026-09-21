-- Section 1 — Quote Metadata: FORWARD migration. DO NOT APPLY WITHOUT REVIEW.
-- Adds four metadata columns (Q1.4, Q1.7, Q1.8, Q1.9) and, only if required,
-- re-exposes them through public.quotes_scoped().
--
-- Preconditions: 0_capture.sql has been run and its output stored.
-- Everything below is DDL only and runs inside a single transaction.
-- (NOTIFY pgrst runs AFTER commit — see the tail of this file.)

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns on public.quotes
-- ---------------------------------------------------------------------------
-- Idempotent. Existing rows take the defaults for the two non-null columns and
-- NULL for the two nullable ones; no existing row is otherwise rewritten, and
-- no existing default or null behaviour on any other column is touched.

alter table public.quotes
  add column if not exists opportunity_stage  text not null default 'discovery',
  add column if not exists deal_priority      text not null default 'standard',
  add column if not exists deal_template      text,
  add column if not exists quote_validity_date date;

-- Value domains, matching Questionnaire v6.4 Section 1 and the Zod schema in
-- src/types/quote.ts. NOT VALID keeps the statement cheap on existing rows;
-- the defaults above already satisfy both constraints, so validate immediately.
alter table public.quotes
  add constraint quotes_opportunity_stage_check
  check (opportunity_stage in
    ('discovery','qualified','proposal','negotiation','closed','other')) not valid;
alter table public.quotes validate constraint quotes_opportunity_stage_check;

alter table public.quotes
  add constraint quotes_deal_priority_check
  check (deal_priority in ('standard','strategic','rush','other')) not valid;
alter table public.quotes validate constraint quotes_deal_priority_check;

alter table public.quotes
  add constraint quotes_deal_template_check
  check (deal_template is null or deal_template in
    ('state_workers_comp','state_health_benefits','county_justice_modernization',
     'federal_small_deployment','blank','other')) not valid;
alter table public.quotes validate constraint quotes_deal_template_check;

comment on column public.quotes.opportunity_stage  is 'Questionnaire v6.4 Q1.4. Internal-only metadata. No pricing effect.';
comment on column public.quotes.deal_priority      is 'Questionnaire v6.4 Q1.7. Internal-only metadata. No pricing effect.';
comment on column public.quotes.deal_template      is 'Questionnaire v6.4 Q1.8. Internal-only metadata. No pricing effect.';
comment on column public.quotes.quote_validity_date is 'Questionnaire v6.4 Q1.9. Customer-visible on PDFs. NULL = no validity statement.';

-- ---------------------------------------------------------------------------
-- 2. public.quotes_scoped() — role-aware read path
-- ---------------------------------------------------------------------------
-- quotes_scoped() is a SECURITY DEFINER set-returning function, NOT a view.
-- There are two possible shapes; 0_capture.sql §0.1 `returns_clause` decides.
--
-- 2a. RETURNS setof public.quotes
--     The composite row type follows the table automatically, so the four new
--     columns are already returned and NO function change is needed. Skip to
--     step 3. Re-read the captured body only to confirm it projects columns via
--     the row type rather than an explicit constructor; if it builds rows with
--     an explicit ROW(...)/SELECT column list, treat it as case 2b.
--
-- 2b. RETURNS TABLE (...) with an explicit column list
--     The function MUST be recreated, otherwise the four columns silently read
--     back as missing for every role, with no error.
--
--     CREATE OR REPLACE FUNCTION cannot change the OUT-parameter list
--     ("cannot change return type of existing function"), so a DROP/CREATE
--     sequence is required. DROP FUNCTION also discards EXECUTE grants, so they
--     are re-applied in the same transaction.
--
--     Fill the body below from 0_capture.sql §0.2 BYTE-FOR-BYTE, changing only:
--       * RETURNS TABLE(...): append, at the END of the list, in this order
--             opportunity_stage   text,
--             deal_priority       text,
--             deal_template       text,
--             quote_validity_date date
--       * the inner SELECT list: append the same four columns, unqualified by
--         any role CASE expression — these are metadata, never pricing, so they
--         are returned verbatim to every role that already passes the WHERE
--         clause.
--     Change NOTHING else: keep the existing WHERE clause (ownership and Sales
--     Representative filtering), every pricing CASE/NULL expression, LANGUAGE,
--     SECURITY DEFINER, `SET search_path`, volatility, and ordering.
--     Do not add the columns anywhere else, and do not re-list any existing
--     column — that is what would duplicate columns.

-- --- BEGIN case-2b block: uncomment and fill only if §0.1 shows RETURNS TABLE
-- drop function public.quotes_scoped();
--
-- create function public.quotes_scoped()
-- returns table (
--   <<< paste the captured column list verbatim >>>,
--   opportunity_stage   text,
--   deal_priority       text,
--   deal_template       text,
--   quote_validity_date date
-- )
-- language sql            -- must match the captured LANGUAGE
-- stable                  -- must match the captured volatility
-- security definer
-- set search_path = public, pg_temp   -- must match the captured proconfig
-- as $function$
--   <<< paste the captured body verbatim, with the four columns appended to
--       the SELECT list and the WHERE clause untouched >>>
-- $function$;
--
-- alter function public.quotes_scoped() owner to <<< captured owner, §0.1 >>>;
-- revoke all on function public.quotes_scoped() from public;
-- grant execute on function public.quotes_scoped() to authenticated;
-- grant execute on function public.quotes_scoped() to service_role;
-- -- Re-apply any ADDITIONAL grantee found in §0.3, and only those.
-- --- END case-2b block

-- ---------------------------------------------------------------------------
-- 3. Conversion RPCs — no change required
-- ---------------------------------------------------------------------------
-- convert_lead_to_quote(), estimator_assign_and_convert() and
-- claim_and_convert_lead() insert an explicit column list into public.quotes.
-- The two NOT NULL columns carry defaults and the two nullable columns accept
-- NULL, so their INSERTs keep working unmodified. Leads carry no Section 1
-- metadata, so there is nothing to map.
--
-- 4. Phase 1A — untouched. No object, grant, policy or search_path covered by
--    docs/phase-1a/ is referenced by this migration.

commit;

-- After commit (cannot run inside the transaction block above):
--   notify pgrst, 'reload schema';
-- Then wait 30-60s before running VERIFY.sql.
