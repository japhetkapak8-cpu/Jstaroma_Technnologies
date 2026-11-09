-- SYNTHETIC LOCAL TEST DATABASE ONLY. Never run in production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  province text
);
alter table public.profiles enable row level security;
\ir ../sql/20261109_admin_province_analytics.sql
\ir ../sql/20261109_admin_province_analytics.sql

insert into auth.users
select md5(n::text)::uuid from generate_series(1, 52) as n;
insert into public.profiles (id, province)
select md5(n::text)::uuid,
  case
    when n <= 10 then '  jiWAKA  '
    when n <= 15 then 'EHP'
    when n <= 19 then 'Manus Province'
    when n <= 21 then 'SHP'
    when n <= 23 then 'Morobe'
    when n <= 25 then 'Enga'
    when n = 26 then 'WHP'
    when n = 27 then 'Gulf'
    when n = 28 then 'Madang'
    when n = 29 then 'Port Moresby'
    when n = 30 then 'Fly River'
    when n = 31 then 'ESP'
    when n = 32 then 'unrecognized value'
    when n = 33 then '   '
    else null
  end
from generate_series(1, 52) as n;

begin read only;
set local role service_role;
do $assert$
declare result jsonb;
declare total bigint;
begin
  result := public.wantok_admin_province_counts_v1();
  select sum((value->>'count')::bigint) into total from jsonb_array_elements(result->'rows');
  if jsonb_array_length(result->'rows') <> 23 or total <> 52
     or not result->'rows' @> '[{"name":"Jiwaka Province","count":10}]'::jsonb
     or not result->'rows' @> '[{"name":"Eastern Highlands Province","count":5}]'::jsonb
     or not result->'rows' @> '[{"name":"Manus Province","count":4}]'::jsonb
     or not result->'rows' @> '[{"name":"Southern Highlands Province","count":2}]'::jsonb
     or not result->'rows' @> '[{"name":"Morobe Province","count":2}]'::jsonb
     or not result->'rows' @> '[{"name":"Enga Province","count":2}]'::jsonb
     or not result->'rows' @> '[{"name":"Western Highlands Province","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"Gulf Province","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"Madang Province","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"National Capital District","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"Western Province","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"East Sepik Province","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"Unknown / Not Set","count":21}]'::jsonb
     or not result->'rows' @> '[{"name":"Hela Province","count":0}]'::jsonb then
    raise exception 'Unexpected province aggregate: %', result;
  end if;
end;
$assert$;
rollback;

insert into auth.users
select md5((n + 52)::text)::uuid from generate_series(1, 8) as n;
insert into public.profiles (id, province)
select md5((n + 52)::text)::uuid, (array[
  'West Sepik', 'Sandaun Province', 'AROB', 'Bougainville',
  'Northern', 'Oro', 'ENB', 'WNB'
])[n] from generate_series(1, 8) as n;
begin read only;
set local role service_role;
do $aliases$
declare result jsonb;
begin
  result := public.wantok_admin_province_counts_v1();
  if not result->'rows' @> '[{"name":"West Sepik (Sandaun) Province","count":2}]'::jsonb
     or not result->'rows' @> '[{"name":"Autonomous Region of Bougainville","count":2}]'::jsonb
     or not result->'rows' @> '[{"name":"Northern (Oro) Province","count":2}]'::jsonb
     or not result->'rows' @> '[{"name":"East New Britain Province","count":1}]'::jsonb
     or not result->'rows' @> '[{"name":"West New Britain Province","count":1}]'::jsonb then
    raise exception 'Province aliases were not normalized: %', result;
  end if;
end;
$aliases$;
rollback;

do $permissions$
begin
  if has_function_privilege('anon', 'public.wantok_admin_province_counts_v1()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.wantok_admin_province_counts_v1()', 'EXECUTE') then
    raise exception 'Client role has province RPC access.';
  end if;
end;
$permissions$;
