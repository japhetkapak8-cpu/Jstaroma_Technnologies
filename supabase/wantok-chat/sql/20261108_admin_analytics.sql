-- WANTOK ONLY: patrtlxmcjrzzfvvfcft.
-- Review and run manually in that project's SQL Editor after approval.
-- This file is deliberately outside supabase/migrations. Never db-push it
-- against Jstaroma (fticsjeytmepljtkfrvm).
begin;

-- Schema guard, not a substitute for checking the SQL Editor's project ID.
do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'service_role' and rolbypassrls
  ) then
    raise exception 'Expected Supabase service_role with RLS bypass.';
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.messages') is null
     or to_regclass('public.calls') is null
     or to_regclass('public.groups') is null
     or to_regclass('public.wantok_user_chat_activity') is null then
    raise exception 'Wantok schema missing. Check that the target project is patrtlxmcjrzzfvvfcft.';
  end if;

  if exists (
    select 1
    from (values
      ('auth', 'users', 'created_at', 'timestamp with time zone'),
      ('public', 'messages', 'message_type', 'text'),
      ('public', 'messages', 'wantok_deleted_for_everyone', 'boolean'),
      ('public', 'calls', 'created_at', 'timestamp with time zone'),
      ('public', 'groups', 'created_at', 'timestamp with time zone')
    ) as required(schema_name, table_name, column_name, data_type)
    where not exists (
      select 1 from information_schema.columns as actual
      where actual.table_schema = required.schema_name
        and actual.table_name = required.table_name
        and actual.column_name = required.column_name
        and actual.data_type = required.data_type
    )
  ) then
    raise exception 'Wantok analytics column types do not match the verified schema.';
  end if;
end;
$guard$;

create or replace function public.wantok_admin_analytics_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'version', 2,
    'metric_scope', 'current_records',
    'generated_at', pg_catalog.to_char(
      pg_catalog.statement_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'period', pg_catalog.jsonb_build_object(
      'start', ((pg_catalog.statement_timestamp() at time zone 'UTC')::date - 30)::text,
      'end', ((pg_catalog.statement_timestamp() at time zone 'UTC')::date - 1)::text
    ),
    'metrics', pg_catalog.jsonb_build_object(
      'registered_users', (select count(*) from auth.users),
      'mau', null,
      'dau', null,
      'messages', (
        select count(*)
        from public.messages
        where message_type is distinct from 'call'
          and wantok_deleted_for_everyone is not true
      ),
      'calls', (select count(*) from public.calls),
      'groups', (select count(*) from public.groups)
    ),
    'growth', null,
    'retention', null
  );
$function$;

-- SECURITY INVOKER avoids elevating callers to the function owner's role.
-- Grant only the columns needed for these read-only aggregates. Existing
-- Supabase service_role grants/RLS bypass are not changed or revoked.
grant usage on schema auth, public to service_role;
grant select (created_at) on auth.users, public.calls, public.groups to service_role;
grant select (message_type, wantok_deleted_for_everyone) on public.messages to service_role;

-- Remove any older explicit grants too; CREATE OR REPLACE preserves ACLs.
do $permissions$
declare
  grantee_name text;
begin
  for grantee_name in
    select distinct roles.rolname
    from pg_catalog.pg_proc as functions
    cross join lateral pg_catalog.aclexplode(
      coalesce(functions.proacl, pg_catalog.acldefault('f', functions.proowner))
    ) as permissions
    join pg_catalog.pg_roles as roles on roles.oid = permissions.grantee
    where functions.oid = 'public.wantok_admin_analytics_v1()'::regprocedure
      and permissions.grantee <> functions.proowner
      and roles.rolname <> 'service_role'
  loop
    execute pg_catalog.format(
      'revoke all on function public.wantok_admin_analytics_v1() from %I cascade',
      grantee_name
    );
  end loop;
end;
$permissions$;

revoke all on function public.wantok_admin_analytics_v1() from public, anon, authenticated;
revoke all on function public.wantok_admin_analytics_v1() from service_role;
grant execute on function public.wantok_admin_analytics_v1() to service_role;

comment on function public.wantok_admin_analytics_v1() is
  'Wantok-only server aggregates, contract v2: current stored records; message calls/global deletions excluded; app activity and historical metrics disconnected.';

commit;
