-- READ ONLY. Run manually in the existing WANTOK CHAT project's SQL Editor.
-- Expected project from the current analytics integration: patrtlxmcjrzzfvvfcft.
-- Verify the project selector first. Do not run against Jstaroma's project.
-- No application rows, passenger identities, credentials or auth.users are read.
-- Application schemas are discovered, not assumed. Inspect every result set:
-- transport objects may have names that do not contain "transport" or "pmv".
begin transaction read only;
set local statement_timeout = '30s';

-- 1. Application relation inventory, including RLS and ownership.
select n.nspname as schema_name, c.relname as relation_name,
       c.relkind, c.relispartition, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       pg_catalog.pg_get_userbyid(c.relowner) as owner,
       pg_catalog.obj_description(c.oid, 'pg_class') as description
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
order by n.nspname, c.relname;

-- 2. Exact columns, types, nullability, generated values, defaults and comments.
select n.nspname as schema_name, c.relname as relation_name,
       a.attnum as ordinal_position, a.attname as column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null, a.attidentity as identity_kind,
       a.attgenerated as generated_kind,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_expression,
       pg_catalog.col_description(c.oid, a.attnum) as description
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where a.attnum > 0 and not a.attisdropped
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, c.relname, a.attnum;

-- 3. PKs, FKs, uniqueness, checks, exclusions and domain constraints.
-- Check definitions can reveal status rules; FKs reveal route/stop/segment joins.
select n.nspname as schema_name, co.conname as constraint_name, co.contype,
       co.conrelid::regclass::text as source_relation,
       nullif(co.confrelid, 0)::regclass::text as referenced_relation,
       co.condeferrable, co.condeferred, co.convalidated,
       pg_catalog.pg_get_constraintdef(co.oid, true) as definition
from pg_catalog.pg_constraint co
join pg_catalog.pg_namespace n on n.oid = co.connamespace
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, source_relation, co.conname;

-- 4. Enum values, including actual supported operator/trip/booking statuses.
select n.nspname as schema_name, t.typname as enum_type,
       e.enumsortorder, e.enumlabel
from pg_catalog.pg_type t
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
join pg_catalog.pg_enum e on e.enumtypid = t.oid
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
order by n.nspname, t.typname, e.enumsortorder;

-- 5. RLS policies: roles, commands, visibility and WITH CHECK expressions.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname !~ '^pg_' and schemaname <> 'information_schema'
  and schemaname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by schemaname, tablename, policyname;

-- 6. Application RPCs/helpers, including transaction/locking and approval logic.
-- Review definitions locally before sharing: legacy function bodies can contain
-- hard-coded secrets. Remove any such values from exported inspection output.
select n.nspname as schema_name, p.proname as routine_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_catalog.pg_get_function_result(p.oid) as result_type,
       pg_catalog.pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer, p.provolatile, p.proconfig,
       pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.prokind in ('f', 'p')
  and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, p.proname, identity_arguments;

-- 7. Non-internal triggers (approval sync, audit, reservation/cancellation hooks).
select n.nspname as schema_name, c.relname as relation_name, t.tgname,
       t.tgenabled, t.tgfoid::regprocedure::text as trigger_function,
       pg_catalog.pg_get_triggerdef(t.oid, true) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, c.relname, t.tgname;

-- 8. Views/materialized views and indexes (existing aggregates/capacity guards).
select n.nspname as schema_name, c.relname as relation_name,
       pg_catalog.pg_get_viewdef(c.oid, true) as definition, c.reloptions
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v', 'm')
  and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, c.relname;

select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname !~ '^pg_' and schemaname <> 'information_schema'
  and schemaname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by schemaname, tablename, indexname;

-- 9. Relation and routine effective direct ACLs, including PUBLIC defaults.
select n.nspname as schema_name, c.relname as relation_name,
       case when acl.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
       acl.privilege_type, acl.is_grantable
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
  pg_catalog.acldefault(case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end, c.relowner))) acl
where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, c.relname, grantee, acl.privilege_type;

select n.nspname as schema_name, p.oid::regprocedure::text as routine,
       case when acl.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
       acl.privilege_type, acl.is_grantable
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
where p.prokind in ('f', 'p')
  and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and n.nspname not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by n.nspname, routine, grantee;

-- Column-specific grants, schema ACLs and default grants supplement relation ACLs.
select table_schema, table_name, column_name, grantee, privilege_type, is_grantable
from information_schema.column_privileges
where table_schema !~ '^pg_' and table_schema <> 'information_schema'
  and table_schema not in ('auth', 'storage', 'extensions', 'realtime',
    'supabase_functions', 'supabase_migrations', 'vault', 'graphql', 'graphql_public',
    'net', 'cron', 'pgbouncer', '_realtime', '_analytics')
order by table_schema, table_name, column_name, grantee;

select n.nspname as schema_name, n.nspacl as schema_acl
from pg_catalog.pg_namespace n
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
order by n.nspname;

select pg_catalog.pg_get_userbyid(d.defaclrole) as owner,
       n.nspname as schema_name, d.defaclobjtype, d.defaclacl
from pg_catalog.pg_default_acl d
left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
order by owner, n.nspname, d.defaclobjtype;

-- 10. Existing publication coverage; this does not enable Realtime.
select pubname, schemaname, tablename
from pg_catalog.pg_publication_tables
where schemaname !~ '^pg_' and schemaname <> 'information_schema'
order by pubname, schemaname, tablename;

rollback;
