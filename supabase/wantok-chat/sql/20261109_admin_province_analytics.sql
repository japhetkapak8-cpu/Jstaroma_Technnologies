-- WANTOK ONLY: patrtlxmcjrzzfvvfcft. Review and run in that project's SQL Editor.
-- Exact small buckets are approved for Jstaroma administrators only.
begin;

do $guard$
declare profile_id smallint;
begin
  select attnum into profile_id from pg_catalog.pg_attribute
  where attrelid = 'public.profiles'::regclass and attname = 'id' and not attisdropped;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'p'
      and conkey = array[profile_id]::smallint[]
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'
      and conkey = array[profile_id]::smallint[]
      and confrelid = 'auth.users'::regclass and convalidated and confdeltype = 'c'
      and confkey = array[(select attnum from pg_catalog.pg_attribute
        where attrelid = 'auth.users'::regclass and attname = 'id' and not attisdropped)]::smallint[]
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'id' and data_type = 'uuid' and is_nullable = 'NO'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'province' and data_type = 'text'
  ) then
    raise exception 'Profile primary key, auth.users relationship or province column does not match the verified schema.';
  end if;
end;
$guard$;

create or replace function public.wantok_admin_province_counts_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with provinces(name, aliases) as (values
    ('Autonomous Region of Bougainville', array['autonomous region of bougainville','bougainville','arob']),
    ('Central Province', array['central']),
    ('Chimbu (Simbu) Province', array['chimbu','simbu','chimbu simbu']),
    ('East New Britain Province', array['east new britain','enb']),
    ('East Sepik Province', array['east sepik','esp']),
    ('Eastern Highlands Province', array['eastern highlands','ehp']),
    ('Enga Province', array['enga']),
    ('Gulf Province', array['gulf']),
    ('Hela Province', array['hela']),
    ('Jiwaka Province', array['jiwaka']),
    ('Madang Province', array['madang']),
    ('Manus Province', array['manus']),
    ('Milne Bay Province', array['milne bay']),
    ('Morobe Province', array['morobe']),
    ('National Capital District', array['national capital district','ncd','port moresby']),
    ('New Ireland Province', array['new ireland']),
    ('Northern (Oro) Province', array['northern','oro','northern oro']),
    ('Southern Highlands Province', array['southern highlands','shp']),
    ('West New Britain Province', array['west new britain','wnb']),
    ('West Sepik (Sandaun) Province', array['west sepik','sandaun','west sepik sandaun']),
    ('Western Highlands Province', array['western highlands','whp']),
    ('Western Province', array['western','fly river'])
  ), normalized as (
    select id, pg_catalog.btrim(pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(pg_catalog.lower(coalesce(province, '')), '[^a-z0-9]+', ' ', 'g'),
      '\s+province\s*$', '', 'g')) as province
    from public.profiles
  ), matched as (
    select normalized.id, coalesce(provinces.name, 'Unknown / Not Set') as name
    from normalized left join provinces on normalized.province = any(provinces.aliases)
  ), counts as (
    select name, count(distinct id) as count from matched group by name
  ), categories as (
    select name from provinces union all select 'Unknown / Not Set'
  )
  select pg_catalog.jsonb_build_object('rows', pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('name', categories.name, 'count', coalesce(counts.count, 0))
    order by categories.name))
  from categories left join counts using (name);
$function$;

grant select (id, province) on public.profiles to service_role;
do $permissions$
declare grantee_name text;
begin
  for grantee_name in
    select distinct roles.rolname from pg_catalog.pg_proc as functions
    cross join lateral pg_catalog.aclexplode(
      coalesce(functions.proacl, pg_catalog.acldefault('f', functions.proowner))
    ) as permissions
    join pg_catalog.pg_roles as roles on roles.oid = permissions.grantee
    where functions.oid = 'public.wantok_admin_province_counts_v1()'::regprocedure
      and permissions.grantee <> functions.proowner and roles.rolname <> 'service_role'
  loop
    execute pg_catalog.format('revoke all on function public.wantok_admin_province_counts_v1() from %I cascade', grantee_name);
  end loop;
end;
$permissions$;
revoke all on function public.wantok_admin_province_counts_v1() from public, anon, authenticated;
revoke all on function public.wantok_admin_province_counts_v1() from service_role;
grant execute on function public.wantok_admin_province_counts_v1() to service_role;
commit;
