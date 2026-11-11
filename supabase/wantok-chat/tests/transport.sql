-- ISOLATED TEST DATABASE ONLY. Creates fixture roles and auth schema.
-- Never run in a real Supabase project. Failure if auth already exists is intentional.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role',true)
$$;
create table auth.users(id uuid primary key,email text);
create table public.transport_operators (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,
  business_name text not null,display_name text not null default '',contact_phone text not null,
  province text not null,operating_area text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  review_note text,reviewed_at timestamptz,created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),operator_id uuid references public.transport_operators,
  vehicle_type text,registration_number text,passenger_capacity integer,is_registration_vehicle boolean default false
);
create table public.transport_trips (
  id uuid primary key default gen_random_uuid(),operator_id uuid references public.transport_operators,
  vehicle_id uuid references public.transport_vehicles,departure text,destination text,province text,
  departure_at timestamptz,departure_timezone text,capacity integer,
  available_seats integer,fare_pgk numeric,pickup_location text,
  status text default 'published' check(status in ('published','completed','cancelled')),
  created_at timestamptz default now(),updated_at timestamptz not null default now()
);
create table public.transport_trip_stops (
  id uuid primary key default gen_random_uuid(),trip_id uuid references public.transport_trips,
  position integer,location text,arrival_at timestamptz,departure_at timestamptz,
  unique(trip_id,position)
);
create table public.transport_reservations (
  id uuid primary key default gen_random_uuid(),trip_id uuid references public.transport_trips,
  passenger_user_id uuid references auth.users,from_stop_id uuid references public.transport_trip_stops,
  to_stop_id uuid references public.transport_trip_stops,quantity integer,fare_per_seat numeric,
  request_id text,status text default 'confirmed' check(status in ('confirmed','cancelled','trip_cancelled')),
  created_at timestamptz default now(),cancelled_at timestamptz,
  unique(passenger_user_id,request_id)
);
create table public.transport_trip_fares (
  trip_id uuid,from_stop_id uuid,to_stop_id uuid,fare_pgk numeric
);
create table public.transport_booking_notices (
  id uuid primary key default gen_random_uuid(),user_id uuid,reservation_id uuid,message text
);
create table public.transport_saved_routes (
  id uuid primary key default gen_random_uuid(),operator_id uuid,name text
);
create table public.transport_saved_route_stops (
  id uuid primary key default gen_random_uuid(),route_id uuid,position integer,location text
);
do $$
declare t text;
begin
  foreach t in array array['transport_operators','transport_vehicles','transport_trips',
    'transport_trip_stops','transport_reservations','transport_saved_routes','transport_saved_route_stops']
  loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;
grant usage on schema auth,public to service_role,anon,authenticated;

-- Supplied existing booking/review implementations, preserved for regression tests.
create function public.transport_booking_json(p_id uuid) returns jsonb language sql as $$
  select jsonb_build_object('id',id,'quantity',quantity,'status',status) from public.transport_reservations where id=p_id
$$;
create function public.transport_cancel_trip_reservations(p_trip_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;
begin
  for r in select id,passenger_user_id from public.transport_reservations
    where trip_id=p_trip_id and status='confirmed' order by id for update
  loop
    update public.transport_reservations set status='trip_cancelled',cancelled_at=now() where id=r.id;
    insert into public.transport_booking_notices(user_id,reservation_id,message)
      values(r.passenger_user_id,r.id,'Your transport trip has been cancelled. Your reservation was cancelled.');
  end loop;
end $$;
create function public.transport_review_operator(p_operator_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_trip record;
begin
  if p_status is null or p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  if p_status='rejected' and coalesce(length(trim(p_note)),0)=0 then raise exception 'Provide a useful rejection reason'; end if;
  perform 1 from public.transport_operators where id=p_operator_id for update;
  if not found then raise exception 'Operator not found'; end if;
  update public.transport_operators set status=p_status,review_note=nullif(trim(p_note),''),
    reviewed_at=now(),updated_at=now() where id=p_operator_id;
  if p_status='rejected' then
    for v_trip in select id from public.transport_trips
      where operator_id=p_operator_id and status='published' order by id for update
    loop
      update public.transport_trips set status='cancelled',updated_at=now() where id=v_trip.id;
      perform public.transport_cancel_trip_reservations(v_trip.id);
    end loop;
  end if;
end $$;
create function public.transport_reserve_seats(p_trip_id uuid,p_from_stop_id uuid,p_to_stop_id uuid,p_quantity integer,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_trip public.transport_trips; v_from int; v_to int;
  v_operator uuid; v_board timestamptz; v_fare numeric(10,2); v_res public.transport_reservations;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if p_request_id is null or length(p_request_id) not between 1 and 120 then raise exception 'Invalid reservation request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_request_id,0));
  select * into v_res from public.transport_reservations where passenger_user_id=v_user and request_id=p_request_id;
  if v_res.id is not null then
    if v_res.trip_id is distinct from p_trip_id or v_res.from_stop_id is distinct from p_from_stop_id
      or v_res.to_stop_id is distinct from p_to_stop_id or v_res.quantity is distinct from p_quantity then
      raise exception 'Request id was already used with different reservation details';
    end if;
    perform 1 from public.transport_trips where id=v_res.trip_id for update;
    return public.transport_booking_json(v_res.id);
  end if;
  if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Invalid reservation quantity'; end if;
  select operator_id into v_operator from public.transport_trips where id=p_trip_id;
  if v_operator is null then raise exception 'Trip is no longer available'; end if;
  perform 1 from public.transport_operators where id=v_operator and status='approved' for share;
  if not found then raise exception 'Trip is no longer available'; end if;
  select * into v_trip from public.transport_trips where id=p_trip_id for update;
  if v_trip.id is null or v_trip.status<>'published' or not exists(
    select 1 from public.transport_operators where id=v_trip.operator_id and status='approved') then
    raise exception 'Trip is no longer available'; end if;
  select position,departure_at into v_from,v_board from public.transport_trip_stops where id=p_from_stop_id and trip_id=p_trip_id;
  select position into v_to from public.transport_trip_stops where id=p_to_stop_id and trip_id=p_trip_id;
  if v_from is null or v_to is null or v_from>=v_to then raise exception 'Choose an ordered boarding and dropoff stop'; end if;
  if v_board is null or v_board<=now() then raise exception 'Selected boarding time is no longer available'; end if;
  if exists(select 1 from public.transport_trip_stops s
    where s.trip_id=p_trip_id and s.position>=v_from and s.position<v_to
      and v_trip.capacity-(select coalesce(sum(r.quantity),0) from public.transport_reservations r
        join public.transport_trip_stops a on a.id=r.from_stop_id
        join public.transport_trip_stops b on b.id=r.to_stop_id
        where r.trip_id=p_trip_id and r.status='confirmed' and a.position<=s.position and b.position>s.position)<p_quantity)
    then raise exception 'Not enough seats remain for one or more selected segments'; end if;
  select coalesce(f.fare_pgk,v_trip.fare_pgk) into v_fare from (select 1) q
    left join public.transport_trip_fares f on f.trip_id=p_trip_id and f.from_stop_id=p_from_stop_id and f.to_stop_id=p_to_stop_id;
  insert into public.transport_reservations(passenger_user_id,trip_id,from_stop_id,to_stop_id,quantity,fare_per_seat,request_id)
  values(v_user,p_trip_id,p_from_stop_id,p_to_stop_id,p_quantity,v_fare,p_request_id) returning * into v_res;
  return public.transport_booking_json(v_res.id);
end $$;
revoke all on function public.transport_review_operator(uuid,text,text) from public;
revoke all on function public.transport_cancel_trip_reservations(uuid) from public;
grant execute on function public.transport_review_operator(uuid,text,text),public.transport_cancel_trip_reservations(uuid) to service_role;
\ir ../sql/20261111_admin_transport.sql

create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',message; end if; end $$;
insert into auth.users values
  ('00000000-0000-0000-0000-000000000001','operator@example.invalid'),
  ('00000000-0000-0000-0000-000000000002','passenger@example.invalid');
insert into public.transport_operators(id,user_id,business_name,contact_phone,province,operating_area)
values('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Test PMV','12345678','Test province','Test area');

select set_config('request.jwt.claim.role','service_role',false);
select public.wantok_admin_transport_decide_v1(
  '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',id,status,updated_at,'approved','Verified application')
from public.transport_operators;
select public.test_assert((select status='approved' from public.transport_operators),'approval');
select public.test_assert((select count(*)=1 from public.wantok_transport_admin_audit),'audit created');
do $$
declare o public.transport_operators;
begin
  select * into o from public.transport_operators;
  begin
    perform public.wantok_admin_transport_decide_v1(
      '00000000-0000-0000-0000-000000000099','operator@example.invalid','operator',o.id,o.status,o.updated_at,'rejected','Self');
    raise exception 'Self review allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.wantok_admin_transport_decide_v1(
      '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',o.id,o.status,o.updated_at,'rejected',' ');
    raise exception 'Blank rejection allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.wantok_admin_transport_decide_v1(
      '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',o.id,'pending',o.updated_at,'approved','Stale');
    raise exception 'Stale review allowed';
  exception when serialization_failure then null; end;
end $$;
select public.test_assert((select count(*)=1 from public.wantok_transport_admin_audit),'failed reviews have no audit writes');
insert into public.transport_trips(id,operator_id,departure,destination,province,departure_at,departure_timezone,capacity,available_seats,fare_pgk)
values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A town','C town','Test province',now()+interval '1 day','Pacific/Port_Moresby',3,99,10);
insert into public.transport_trip_stops(id,trip_id,position,location,arrival_at,departure_at)
select ('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
  '20000000-0000-0000-0000-000000000001',i,case i when 1 then 'A town' when 2 then 'B town' else 'C town' end,
  now()+interval '1 day'+i*interval '1 hour',now()+interval '1 day'+i*interval '1 hour'
from generate_series(1,3) i;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.transport_reserve_seats('20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',2,'first');
select public.transport_reserve_seats('20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003',2,'second');
select public.transport_reserve_seats('20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',2,'first');
select public.test_assert((select count(*)=2 from public.transport_reservations),'idempotent reservations');
select public.test_assert((select bool_and(reserved=2 and remaining=1) from public.wantok_admin_transport_segments_v1),'non-overlapping multi-passenger bookings');
do $$
begin
  begin
    perform public.transport_reserve_seats('20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003',2,'overbook');
    raise exception 'FAILED: overbooking allowed';
  exception when raise_exception then
    if sqlerrm not like 'Not enough seats%' then raise; end if;
  end;
end $$;
select public.test_assert(
  (public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1)->'metrics'->>'available_seats')::int=1,
  'available seats ignore legacy client field');
select public.test_assert(
  (public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1)->'metrics'->>'seats_reserved')::int=4,
  'sum passenger quantities, not booking count');

-- Place this fixture trip within the reporting period to check period occupancy.
update public.transport_trips set departure_at=(current_date-1)::timestamp at time zone 'UTC';
select public.test_assert(
  public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1)->'occupancy'=
    '{"reserved":4,"capacity":6}'::jsonb,'segment-weighted occupancy');
select public.test_assert(jsonb_array_length(
  public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1)->'daily')=7,'daily continuity');
select public.test_assert(
  (public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1,'nomatch')->'operators'->>'total')::int=0,'literal search filter');
select public.test_assert(not has_function_privilege('authenticated',
  'public.wantok_admin_transport_decide_v1(uuid,text,text,uuid,text,timestamptz,text,text)','EXECUTE'),'ordinary users cannot review');
select public.test_assert(not has_table_privilege('authenticated','public.wantok_transport_admin_audit','INSERT,UPDATE,DELETE'),'audit protected');
select public.test_assert(not has_column_privilege('service_role',
  'public.transport_reservations','passenger_user_id','SELECT'),'migration adds no passenger identity grant');
select public.test_assert(not has_function_privilege('anon',
  'public.wantok_admin_transport_snapshot_v1(date,date,text,text,integer,text,text,integer)','EXECUTE'),'no public analytics');
set role authenticated;
do $$ begin
  begin
    perform public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1);
    raise exception 'FAILED: authenticated role read admin data';
  exception when insufficient_privilege then null; end;
  begin
    perform public.wantok_admin_transport_decide_v1(
      '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',
      '10000000-0000-0000-0000-000000000001','approved',now(),'rejected','Forged server role');
    raise exception 'FAILED: authenticated role reviewed itself';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
select public.test_assert(
  (public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1)->'metrics'->>'total_operators')::int=1,
  'actual service role can read aggregates through RLS');
reset role;
select set_config('request.jwt.claim.role','authenticated',false);
do $$ begin
  begin
    perform public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1);
    raise exception 'FAILED: non-server accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.role','service_role',false);
do $$
declare t public.transport_trips;
begin
  select * into t from public.transport_trips;
  begin
    perform public.wantok_admin_transport_decide_v1(
      '00000000-0000-0000-0000-000000000099','admin@example.invalid','trip',t.id,t.status,t.updated_at,'completed','Too early');
    raise exception 'FAILED: future boarding completion allowed';
  exception when invalid_parameter_value then null; end;
end $$;
select public.wantok_admin_transport_decide_v1(
  '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',id,status,updated_at,'rejected','Vehicle registration invalid')
from public.transport_operators;
select public.test_assert((select bool_and(status='trip_cancelled') from public.transport_reservations),'rejection cancels reservations');
select public.test_assert((select count(*)=2 from public.transport_booking_notices),'cancellation notices');
select public.transport_cancel_trip_reservations('20000000-0000-0000-0000-000000000001');
select public.test_assert((select count(*)=2 from public.transport_booking_notices),'repeated cancellation sends no duplicate notices');
select public.test_assert((select count(*)=2 from public.wantok_transport_admin_audit),'audit all successful decisions');
select public.test_assert(
  (public.wantok_admin_transport_snapshot_v1(current_date-7,current_date-1)->'metrics'->>'seats_reserved')::int=0,'cancelled passengers excluded');

-- An audit insertion failure must roll back the decision and its side effects.
create function public.test_fail_audit() returns trigger language plpgsql as $$
begin raise exception 'test audit failure'; end $$;
create trigger test_fail_audit before insert on public.wantok_transport_admin_audit
for each row execute function public.test_fail_audit();
do $$
declare o public.transport_operators;
begin
  select * into o from public.transport_operators;
  begin
    perform public.wantok_admin_transport_decide_v1(
      '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',o.id,o.status,o.updated_at,'approved','Test rollback');
    raise exception 'FAILED: audit failure ignored';
  exception when raise_exception then
    if sqlerrm<>'test audit failure' then raise; end if;
  end;
  perform public.test_assert((select status='rejected' from public.transport_operators),'atomic decision rollback');
end $$;
drop trigger test_fail_audit on public.wantok_transport_admin_audit;

-- Real concurrent sessions contend on the existing reservation locks.
create extension dblink;
select public.wantok_admin_transport_decide_v1(
  '00000000-0000-0000-0000-000000000099','admin@example.invalid','operator',id,status,updated_at,'approved','Concurrency fixture')
from public.transport_operators;
update public.transport_trips set status='published',departure_at=now()+interval '1 day';
create function public.test_concurrent_reserve(p_request text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  perform public.transport_reserve_seats('20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003',3,p_request);
  perform pg_sleep(0.5);
  return 'booked';
exception when raise_exception then
  if sqlerrm like 'Not enough seats%' then return 'full'; end if;
  raise;
end $$;
select dblink_connect('booking1','host=/tmp/pgsocket dbname=postgres user=postgres');
select dblink_connect('booking2','host=/tmp/pgsocket dbname=postgres user=postgres');
select dblink_send_query('booking1',$$select public.test_concurrent_reserve('concurrent1')$$);
select dblink_send_query('booking2',$$select public.test_concurrent_reserve('concurrent2')$$);
create temporary table concurrent_results(result text);
insert into concurrent_results select result from dblink_get_result('booking1') as t(result text);
insert into concurrent_results select result from dblink_get_result('booking2') as t(result text);
select public.test_assert((select count(*) filter(where result='booked')=1
  and count(*) filter(where result='full')=1 from concurrent_results),'exactly one concurrent booking succeeds');
select public.test_assert((select bool_and(remaining=0 and reserved=3)
  from public.wantok_admin_transport_segments_v1),'concurrent bookings never overbook');
select dblink_disconnect('booking1');
select dblink_disconnect('booking2');
select 'PASS: transport SQL authorization, approval/audit rollback, concurrent segment capacity and analytics';
