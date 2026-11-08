-- WANTOK ONLY: patrtlxmcjrzzfvvfcft. Review first; never put in Jstaroma migrations.
-- Install 20261108_admin_analytics.sql first. No application data is written.
begin;

do $guard$
begin
  if to_regprocedure('public.wantok_admin_analytics_v1()') is null then
    raise exception 'Install the Wantok base aggregate RPC first, in patrtlxmcjrzzfvvfcft only.';
  end if;
  if exists (
    select 1 from (values
      ('messages', 'created_at', 'timestamp with time zone'),
      ('calls', 'call_type', 'text')
    ) as required(table_name, column_name, data_type)
    where not exists (
      select 1 from information_schema.columns as actual
      where actual.table_schema = 'public' and actual.table_name = required.table_name
        and actual.column_name = required.column_name and actual.data_type = required.data_type
    )
  ) then
    raise exception 'Verified Wantok message/call columns do not match.';
  end if;
end;
$guard$;

create or replace function public.wantok_admin_analytics_range_v1(p_start date, p_end date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
  series jsonb;
  details jsonb;
  start_time timestamptz := p_start::timestamp at time zone 'UTC';
  end_time timestamptz := (p_end + 1)::timestamp at time zone 'UTC';
begin
  if p_start is null or p_end is null or p_end < p_start
     or p_end - p_start >= 366
     or p_end >= (pg_catalog.statement_timestamp() at time zone 'UTC')::date then
    raise exception 'Choose 1-366 complete UTC days ending before today.' using errcode = '22023';
  end if;

  with registrations as (
    select (created_at at time zone 'UTC')::date as day, count(*) as count
    from auth.users where created_at >= start_time and created_at < end_time
    group by 1
  ), messages as (
    select (created_at at time zone 'UTC')::date as day, count(*) as count
    from public.messages where created_at >= start_time and created_at < end_time
      and message_type is distinct from 'call' and wantok_deleted_for_everyone is not true
    group by 1
  ), calls as (
    select (created_at at time zone 'UTC')::date as day, count(*) as count
    from public.calls where created_at >= start_time and created_at < end_time
    group by 1
  )
  select pg_catalog.jsonb_build_object(
    'registrations', pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('date', days.day::date::text, 'count', coalesce(registrations.count, 0)) order by days.day),
    'messages', pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('date', days.day::date::text, 'count', coalesce(messages.count, 0)) order by days.day),
    'calls', pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('date', days.day::date::text, 'count', coalesce(calls.count, 0)) order by days.day)
  ) into series
  from pg_catalog.generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') as days(day)
  left join registrations on registrations.day = days.day::date
  left join messages on messages.day = days.day::date
  left join calls on calls.day = days.day::date;

  select pg_catalog.jsonb_build_object(
    'new_registrations', (select count(*) from auth.users where created_at >= start_time and created_at < end_time),
    'period_messages', (select count(*) from public.messages where created_at >= start_time and created_at < end_time
      and message_type is distinct from 'call' and wantok_deleted_for_everyone is not true),
    'period_calls', (select count(*) from public.calls where created_at >= start_time and created_at < end_time),
    'text_messages', count(*) filter (where message_type = 'text'),
    'voice_notes', count(*) filter (where message_type = 'audio'),
    'shared_photos', count(*) filter (where message_type = 'image'),
    'audio_calls', (select count(*) from public.calls where created_at >= start_time and created_at < end_time and call_type = 'audio'),
    'video_calls', (select count(*) from public.calls where created_at >= start_time and created_at < end_time and call_type = 'video'),
    'total_audio_calls', (select count(*) from public.calls where call_type = 'audio'),
    'total_video_calls', (select count(*) from public.calls where call_type = 'video'),
    'online_users', null, 'monthly_growth', null, 'missed_calls', null,
    'completed_calls', null, 'average_call_duration', null,
    'returning_users', null, 'inactive_users', null,
    'crash_free_sessions', null, 'startup_time', null, 'network_errors', null, 'installations', null,
    'database_usage', null, 'media_storage', null, 'livekit_minutes', null, 'livekit_bandwidth', null,
    'hosting_cost', null, 'revenue', null, 'expenses', null, 'profit', null,
    'account_reports', null, 'blocks', null, 'moderation_actions', null, 'safety_incidents', null
  ) into details
  from public.messages
  where created_at >= start_time and created_at < end_time
    and message_type is distinct from 'call' and wantok_deleted_for_everyone is not true;

  result := public.wantok_admin_analytics_v1();
  return result || pg_catalog.jsonb_build_object(
    'version', 3,
    'period', pg_catalog.jsonb_build_object('start', p_start::text, 'end', p_end::text),
    'platform', pg_catalog.jsonb_build_object(
      'metrics', details, 'series', series,
      'geography', pg_catalog.jsonb_build_object('countries', null, 'provinces', null),
      'devices', null
    )
  );
end;
$function$;

grant select (created_at) on public.messages to service_role;
grant select (call_type) on public.calls to service_role;

do $permissions$
declare grantee_name text;
begin
  for grantee_name in
    select distinct roles.rolname from pg_catalog.pg_proc as functions
    cross join lateral pg_catalog.aclexplode(
      coalesce(functions.proacl, pg_catalog.acldefault('f', functions.proowner))
    ) as permissions
    join pg_catalog.pg_roles as roles on roles.oid = permissions.grantee
    where functions.oid = 'public.wantok_admin_analytics_range_v1(date,date)'::regprocedure
      and permissions.grantee <> functions.proowner and roles.rolname <> 'service_role'
  loop
    execute pg_catalog.format(
      'revoke all on function public.wantok_admin_analytics_range_v1(date,date) from %I cascade', grantee_name);
  end loop;
end;
$permissions$;

revoke all on function public.wantok_admin_analytics_range_v1(date,date) from public, anon, authenticated, service_role;
grant execute on function public.wantok_admin_analytics_range_v1(date,date) to service_role;
comment on function public.wantok_admin_analytics_range_v1(date,date) is
  'Wantok analytics v3: bounded UTC aggregates over surviving records; no app activity, locations, conversations or provider metrics.';
commit;
