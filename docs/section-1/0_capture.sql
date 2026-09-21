-- Section 1 — STEP 0: capture the pre-change state. READ ONLY.
-- Store every result verbatim before running 1_forward.sql.

-- 0.1 Object class: confirm quotes_scoped is a function, not a view/table.
select c.relname, c.relkind, pg_get_userbyid(c.relowner) as owner,
       c.reloptions   -- security_barrier would appear here if it were a view
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'quotes_scoped';
-- Expected: 0 rows (it is a function).

select p.oid::regprocedure as signature,
       p.prosecdef        as is_security_definer,
       p.provolatile,
       pg_get_userbyid(p.proowner) as owner,
       p.proconfig        as config_incl_search_path,
       pg_get_function_result(p.oid) as returns_clause
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'quotes_scoped';

-- 0.2 EXACT prior definition. This output is the rollback artefact.
select pg_get_functiondef('public.quotes_scoped()'::regprocedure);

-- 0.3 EXACT prior EXECUTE grants (DROP FUNCTION discards these).
select grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public' and routine_name = 'quotes_scoped';

-- 0.4 Current quotes column list (confirm the four columns do NOT yet exist,
--     and capture ordinal positions so the recreated SELECT list matches).
select ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'quotes'
order by ordinal_position;

-- 0.5 Dependencies on quotes_scoped (other functions/views referencing it).
select p.oid::regprocedure as dependent_routine
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc ilike '%quotes_scoped%'
  and p.proname <> 'quotes_scoped';

select table_schema, table_name
from information_schema.views
where view_definition ilike '%quotes_scoped%';

-- 0.6 RLS policies on quotes (for reference only — none are modified).
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'quotes'
order by policyname;
