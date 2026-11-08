-- WANTOK ONLY: patrtlxmcjrzzfvvfcft. Run AFTER approved RPC installation.
-- Read-only smoke checks: no application records are written.
begin read only;

do $verify$
declare
  snapshot jsonb;
begin
  if pg_catalog.has_function_privilege('anon', 'public.wantok_admin_analytics_v1()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.wantok_admin_analytics_v1()', 'EXECUTE') then
    raise exception 'Public/client roles must not execute Wantok analytics.';
  end if;
  if not pg_catalog.has_function_privilege('service_role', 'public.wantok_admin_analytics_v1()', 'EXECUTE') then
    raise exception 'Missing server-only RPC execution grant.';
  end if;

  snapshot := public.wantok_admin_analytics_v1();
  if snapshot->>'version' is distinct from '2'
     or snapshot->>'metric_scope' is distinct from 'current_records'
     or snapshot->'metrics'->'mau' is distinct from 'null'::jsonb
     or snapshot->'metrics'->'dau' is distinct from 'null'::jsonb
     or snapshot->'growth' is distinct from 'null'::jsonb
     or snapshot->'retention' is distinct from 'null'::jsonb then
    raise exception 'Wrong contract or unverified activity data returned.';
  end if;
  if (snapshot->'metrics'->>'registered_users')::bigint is distinct from (select count(*) from auth.users)
     or (snapshot->'metrics'->>'messages')::bigint is distinct from (
       select count(*) from public.messages
       where message_type is distinct from 'call' and wantok_deleted_for_everyone is not true
     )
     or (snapshot->'metrics'->>'calls')::bigint is distinct from (select count(*) from public.calls)
     or (snapshot->'metrics'->>'groups')::bigint is distinct from (select count(*) from public.groups) then
    raise exception 'Aggregate counts do not match source queries.';
  end if;
end;
$verify$;

-- Also prove that the invoker's server role can read all required sources.
set local role service_role;
select public.wantok_admin_analytics_v1();
rollback;
