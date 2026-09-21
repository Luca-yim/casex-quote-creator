-- Section 1 — post-migration verification. READ ONLY.

-- 1. Columns exist exactly once, with the intended defaults/nullability.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'quotes'
  and column_name in
    ('opportunity_stage','deal_priority','deal_template','quote_validity_date')
order by column_name;
-- Expect exactly 4 rows.
-- opportunity_stage text NO 'discovery'::text
-- deal_priority     text NO 'standard'::text
-- deal_template     text YES null
-- quote_validity_date date YES null

-- 2. No duplicate column names anywhere in quotes.
select column_name, count(*)
from information_schema.columns
where table_schema = 'public' and table_name = 'quotes'
group by column_name having count(*) > 1;
-- Expect 0 rows.

-- 3. Existing rows kept their values and got the defaults.
select count(*) as total,
       count(*) filter (where opportunity_stage = 'discovery') as stage_default,
       count(*) filter (where deal_priority = 'standard')      as priority_default,
       count(*) filter (where deal_template is null)           as template_null,
       count(*) filter (where quote_validity_date is null)     as validity_null
from public.quotes;

-- 4. quotes_scoped() is unchanged in security posture.
select p.prosecdef as is_security_definer,
       pg_get_userbyid(p.proowner) as owner,
       p.proconfig,
       pg_get_function_result(p.oid) as returns_clause
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'quotes_scoped';
-- Compare field-by-field against 0_capture.sql §0.1.

select pg_get_functiondef('public.quotes_scoped()'::regprocedure);
-- Diff against §0.2: the ONLY differences allowed are the four appended
-- columns in RETURNS TABLE(...) and in the SELECT list. The WHERE clause and
-- every pricing CASE/NULL expression must be byte-identical.

-- 5. Grants survived the DROP/CREATE.
select grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public' and routine_name = 'quotes_scoped';
-- Must match §0.3 exactly. PUBLIC must not appear.

-- 6. RLS policies on quotes are unchanged.
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'quotes'
order by policyname;
-- Diff against §0.6: expect zero differences.

-- 7. Role-based behaviour — run as a real authenticated session, not as
--    postgres/service_role (SECURITY DEFINER hides the difference otherwise).
--    a) Sales Representative: sees only the quotes the prior filter allowed
--       (same row count as before the change), all four metadata fields
--       populated, and every pricing column still NULL.
--    b) Estimator / Admin: same row set as before, metadata populated,
--       pricing unchanged.
--    c) External: row set unchanged.
select id, opportunity_stage, deal_priority, deal_template, quote_validity_date
from quotes_scoped() limit 5;

-- 8. Conversion RPCs still work (run in a disposable environment only):
--    convert_lead_to_quote / estimator_assign_and_convert /
--    claim_and_convert_lead should each produce a quote with
--    opportunity_stage='discovery', deal_priority='standard',
--    deal_template IS NULL, quote_validity_date IS NULL.
