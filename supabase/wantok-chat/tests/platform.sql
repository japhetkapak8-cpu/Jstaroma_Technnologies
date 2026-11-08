-- SYNTHETIC LOCAL TEST DATABASE ONLY. Run with the Docker command in README.
-- Creates local fixture roles/tables. NEVER run in a production SQL Editor.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (created_at timestamptz);
create table public.profiles (created_at timestamptz);
create table public.messages (
  created_at timestamptz, message_type text,
  wantok_deleted_for_everyone boolean
);
create table public.calls (created_at timestamptz, call_type text);
create table public.groups (created_at timestamptz);
create table public.wantok_user_chat_activity (updated_at timestamptz);
alter table auth.users enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;
alter table public.groups enable row level security;

\ir ../sql/20261108_admin_analytics.sql
\ir ../sql/20261108_analytics_platform.sql
\ir ../sql/20261108_analytics_platform.sql

-- UTC boundaries: include start, exclude end+1; exclude call/deleted messages.
insert into auth.users values
  ('2026-10-31T23:59:59Z'), ('2026-11-01T00:00:00Z'),
  ('2026-11-07T23:59:59Z'), ('2026-11-08T00:00:00Z');
insert into public.messages values
  ('2026-11-01T00:00:00Z', 'text', false),
  ('2026-11-01T00:00:00Z', 'audio', null),
  ('2026-11-07T23:59:59Z', 'image', false),
  ('2026-11-07T23:59:59Z', 'call', false),
  ('2026-11-07T23:59:59Z', 'text', true),
  ('2026-11-08T00:00:00Z', 'text', false);
insert into public.calls values
  ('2026-11-01T00:00:00Z', 'audio'),
  ('2026-11-07T23:59:59Z', 'video'),
  ('2026-11-08T00:00:00Z', 'audio');

begin read only;
set local time zone 'Pacific/Port_Moresby';
set local role service_role;
do $assert$
declare snapshot jsonb;
declare day_count bigint;
begin
  snapshot := public.wantok_admin_analytics_range_v1('2026-11-01', '2026-11-07');
  if snapshot->>'version' <> '3'
     or (snapshot->'platform'->'metrics'->>'new_registrations')::bigint <> 2
     or (snapshot->'platform'->'metrics'->>'period_messages')::bigint <> 3
     or (snapshot->'platform'->'metrics'->>'period_calls')::bigint <> 2
     or (snapshot->'platform'->'metrics'->>'text_messages')::bigint <> 1
     or (snapshot->'platform'->'metrics'->>'voice_notes')::bigint <> 1
     or (snapshot->'platform'->'metrics'->>'shared_photos')::bigint <> 1
     or (snapshot->'platform'->'metrics'->>'audio_calls')::bigint <> 1
     or (snapshot->'platform'->'metrics'->>'video_calls')::bigint <> 1
     or (snapshot->'platform'->'metrics'->>'total_audio_calls')::bigint <> 2
     or (snapshot->'platform'->'metrics'->>'total_video_calls')::bigint <> 1
     or snapshot->'metrics'->'mau' <> 'null'::jsonb
     or snapshot->'platform'->'metrics'->'completed_calls' <> 'null'::jsonb
     or snapshot->'platform'->'geography'->'provinces' <> 'null'::jsonb
     or jsonb_array_length(snapshot->'platform'->'series'->'registrations') <> 7 then
    raise exception 'Incorrect UTC aggregate response: %', snapshot;
  end if;
  select sum((value->>'count')::bigint) into day_count
  from jsonb_array_elements(snapshot->'platform'->'series'->'registrations');
  if day_count <> 2 then raise exception 'Daily series does not match totals.'; end if;
  begin
    perform public.wantok_admin_analytics_range_v1('2020-01-01', '2026-11-07');
    raise exception 'Long range incorrectly accepted.';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.wantok_admin_analytics_range_v1(current_date, current_date);
    raise exception 'Incomplete day incorrectly accepted.';
  exception when invalid_parameter_value then null;
  end;
end;
$assert$;
rollback;

do $permissions$
begin
  if has_function_privilege('anon', 'public.wantok_admin_analytics_range_v1(date,date)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.wantok_admin_analytics_range_v1(date,date)', 'EXECUTE') then
    raise exception 'Client role has RPC access.';
  end if;
end;
$permissions$;
select public.wantok_admin_analytics_range_v1('2026-11-01', '2026-11-07');
