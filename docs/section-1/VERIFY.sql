-- Section 1 (Quote Metadata) — VERIFICATION (read-only)
-- Run against the application database after 1_forward.sql commits.

-- 1. Columns exist with the intended types, defaults and nullability
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'quotes'
  and column_name in ('opportunity_stage','deal_priority','deal_template','quote_validity_date')
order by column_name;
-- Expect: opportunity_stage text NO 'discovery'::text
--         deal_priority     text NO 'standard'::text
--         deal_template     text YES (no default)
--         quote_validity_date date YES (no default)

-- 2. Existing rows carry the defaults; validity date untouched
select count(*) as total,
       count(*) filter (where opportunity_stage = 'discovery') as stage_discovery,
       count(*) filter (where deal_priority = 'standard')      as priority_standard,
       count(*) filter (where deal_template is null)           as template_null,
       count(*) filter (where quote_validity_date is null)     as validity_null
from public.quotes;

-- 3. Constraints present and validated
select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.quotes'::regclass
  and conname in ('quotes_opportunity_stage_check','quotes_deal_priority_check','quotes_deal_template_check')
order by conname;

-- 4. Constraints reject invalid values (each must raise; roll back after)
-- begin; update public.quotes set opportunity_stage = 'bogus' where id = (select id from public.quotes limit 1); rollback;
-- begin; update public.quotes set deal_priority     = 'bogus' where id = (select id from public.quotes limit 1); rollback;
-- begin; update public.quotes set deal_template     = 'bogus' where id = (select id from public.quotes limit 1); rollback;

-- 5. No duplicate output columns from the function; four new ones at the end
select ordinality, name
from unnest(
  (select proargnames from pg_proc where oid = 'public.quotes_scoped()'::regprocedure)
) with ordinality as t(name, ordinality);

select name, count(*)
from unnest(
  (select proargnames from pg_proc where oid = 'public.quotes_scoped()'::regprocedure)
) as t(name)
group by name having count(*) > 1;
-- Expect: zero rows

-- 6. Security posture unchanged: SECURITY DEFINER, STABLE, sql, owner postgres, search_path public
select p.proname,
       p.prosecdef        as security_definer,
       p.provolatile      as volatility,   -- 's' = stable
       l.lanname          as language,
       pg_get_userbyid(p.proowner) as owner,
       p.proconfig        as config
from pg_proc p
join pg_language l on l.oid = p.prolang
where p.oid = 'public.quotes_scoped()'::regprocedure;

-- 7. Grants: postgres and authenticated only; no PUBLIC, no service_role
select grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public' and routine_name = 'quotes_scoped'
order by grantee;

-- 8. Full definition for diff against the capture (only the four appended
--    columns/expressions may differ)
select pg_get_functiondef('public.quotes_scoped()'::regprocedure);

-- 9. RLS policies on quotes unchanged
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'quotes'
order by policyname;

-- 10. Phase 1A objects unchanged (spot check: pricing_catalog policies/grants)
select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'pricing_catalog' order by policyname;
select grantee, privilege_type from information_schema.table_privileges
where table_schema = 'public' and table_name = 'pricing_catalog' order by grantee, privilege_type;

-- 11. Role behaviour through real authenticated sessions (run from the app,
--     not as postgres): a sales_rep must still see only owned non-draft quotes
--     and must still receive NULL margin_justification; an estimator/admin must
--     still see margin fields. Compare against pre-migration output.
--     select id, state, margin_percent, margin_justification,
--            opportunity_stage, deal_priority, deal_template, quote_validity_date
--     from public.quotes_scoped() order by created_at desc limit 20;

-- 12. Conversion RPCs still insert successfully (defaults applied, no nulls in
--     the NOT NULL columns) — exercise convert_lead_to_quote /
--     claim_and_convert_lead / estimator_assign_and_convert in staging, then:
--     select opportunity_stage, deal_priority from public.quotes
--     order by created_at desc limit 5;
