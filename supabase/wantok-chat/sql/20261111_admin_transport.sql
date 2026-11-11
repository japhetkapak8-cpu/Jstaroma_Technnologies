-- REVIEW ONLY. WANTOK CHAT (patrtlxmcjrzzfvvfcft), never Jstaroma.
-- Based on the supplied transport schema/RPC inspection, 2026-11-11.
-- Do not apply without approval. Does not replace routing or booking functions.
begin;

do $guard$
declare t text; f regprocedure;
begin
  foreach t in array array['transport_operators','transport_vehicles',
    'transport_trips','transport_trip_stops','transport_reservations',
    'transport_saved_routes','transport_saved_route_stops']
  loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relrowsecurity) then
      raise exception 'Missing transport table or disabled RLS: %',t;
    end if;
    if has_table_privilege('anon',format('public.%I',t),'INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated',format('public.%I',t),'INSERT,UPDATE,DELETE')
       or exists(select 1 from information_schema.column_privileges
         where table_schema='public' and table_name=t and grantee in ('anon','authenticated','PUBLIC')
         and privilege_type in ('INSERT','UPDATE')) then
      raise exception 'Review direct transport write grants before installation: %',t;
    end if;
  end loop;
  foreach f in array array[
    'public.transport_review_operator(uuid,text,text)'::regprocedure,
    'public.transport_cancel_trip_reservations(uuid)'::regprocedure]
  loop
    if has_function_privilege('anon',f,'EXECUTE')
      or has_function_privilege('authenticated',f,'EXECUTE') then
      raise exception 'Unsafe existing helper grants: %',f;
    end if;
  end loop;
  if not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls) then
    raise exception 'Expected Supabase server role';
  end if;
end;
$guard$;

-- New integration-owned audit table, not an assumed existing transport table.
-- Actors belong to Jstaroma auth, so intentionally no FK to Wantok auth.users.
create table public.wantok_transport_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_project text not null check(actor_project='fticsjeytmepljtkfrvm'),
  actor_id uuid not null,
  target_kind text not null check(target_kind in ('operator','trip')),
  target_id uuid not null,
  old_status text not null,
  new_status text not null,
  reason text not null check(length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.wantok_transport_admin_audit enable row level security;
revoke all on public.wantok_transport_admin_audit from public,anon,authenticated,service_role;
grant select on public.wantok_transport_admin_audit to service_role;
create index on public.wantok_transport_admin_audit(created_at desc,id);

-- A seat is consumed on each overlapping segment, not on every leg of the trip.
create view public.wantok_admin_transport_segments_v1
with (security_invoker=true) as
select t.id as trip_id,s.position,s.departure_at,t.capacity,
  coalesce(sum(r.quantity) filter(where r.status='confirmed'),0)::bigint as reserved,
  t.capacity-coalesce(sum(r.quantity) filter(where r.status='confirmed'),0)::bigint as remaining
from public.transport_trips t
join public.transport_trip_stops s on s.trip_id=t.id
  and s.position<(select max(z.position) from public.transport_trip_stops z where z.trip_id=t.id)
left join (
  public.transport_reservations r
  join public.transport_trip_stops a on a.id=r.from_stop_id and a.trip_id=r.trip_id
  join public.transport_trip_stops b on b.id=r.to_stop_id and b.trip_id=r.trip_id
) on r.trip_id=t.id and a.position<=s.position and b.position>s.position
group by t.id,s.id,s.position,s.departure_at,t.capacity;
revoke all on public.wantok_admin_transport_segments_v1 from public,anon,authenticated;
grant select on public.wantok_admin_transport_segments_v1 to service_role;

create function public.wantok_admin_transport_snapshot_v1(
  p_start date,p_end date,
  p_operator_search text default '',p_operator_status text default '',p_operator_page integer default 0,
  p_trip_search text default '',p_trip_status text default '',p_trip_page integer default 0
) returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Server access required' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365
    or p_end>=(now() at time zone 'UTC')::date
    or p_operator_page is null or p_operator_page not between 0 and 10000
    or p_trip_page is null or p_trip_page not between 0 and 10000
    or p_operator_search is null or length(p_operator_search)>100
    or p_trip_search is null or length(p_trip_search)>100
    or p_operator_status is null or p_operator_status not in ('','pending','approved','rejected')
    or p_trip_status is null or p_trip_status not in ('','published','completed','cancelled') then
    raise exception 'Invalid transport filters' using errcode='22023';
  end if;
  -- Unknown statuses/negative capacities must never become success-shaped totals.
  if exists(select 1 from public.transport_operators where status not in ('pending','approved','rejected'))
    or exists(select 1 from public.transport_trips where status not in ('published','completed','cancelled'))
    or exists(select 1 from public.transport_reservations where status not in ('confirmed','cancelled','trip_cancelled'))
    or exists(select 1 from public.wantok_admin_transport_segments_v1 where remaining<0) then
    raise exception 'Transport source rules or capacity require review';
  end if;
  with
  period_trips as (
    select id,operator_id,departure,destination,departure_at,status from public.transport_trips
    where departure_at>=p_start::timestamp at time zone 'UTC'
      and departure_at<(p_end+1)::timestamp at time zone 'UTC'
  ),
  filtered_operators as (
    select o.id,o.business_name,o.display_name,o.contact_phone,o.province,o.operating_area,
      o.status,o.review_note,o.reviewed_at,o.created_at,o.updated_at
    from public.transport_operators o
    where (p_operator_status='' or o.status=p_operator_status)
      and (p_operator_search='' or strpos(lower(concat_ws(' ',o.business_name,o.display_name,
        o.contact_phone,o.province,o.operating_area)),lower(p_operator_search))>0
        or exists(select 1 from public.transport_vehicles v where v.operator_id=o.id
          and strpos(lower(v.registration_number),lower(p_operator_search))>0))
  ),
  operator_rows as (
    select o.id,o.business_name,o.display_name,o.contact_phone,o.province,o.operating_area,
      o.status,o.review_note,o.reviewed_at,o.created_at,o.updated_at,
      coalesce((select jsonb_agg(jsonb_build_object('vehicle_type',v.vehicle_type,
        'registration_number',v.registration_number,'passenger_capacity',v.passenger_capacity)
        order by v.is_registration_vehicle desc,v.id) from public.transport_vehicles v
        where v.operator_id=o.id),'[]'::jsonb) as vehicles,
      coalesce((select jsonb_agg(jsonb_build_object('name',q.name,'stops',q.stops) order by q.id)
        from (select r.id,r.name,coalesce((select jsonb_agg(s.location order by s.position)
          from public.transport_saved_route_stops s where s.route_id=r.id),'[]'::jsonb) as stops
          from public.transport_saved_routes r where r.operator_id=o.id) q),'[]'::jsonb) as routes
    from filtered_operators o order by o.created_at desc,o.id limit 25 offset p_operator_page*25
  ),
  filtered_trips as (
    select t.id,t.vehicle_id,t.departure,t.destination,t.province,t.departure_at,
      t.departure_timezone,t.status,t.capacity,t.updated_at,o.business_name as operator_name
    from public.transport_trips t
    join public.transport_operators o on o.id=t.operator_id
    where (p_trip_status='' or t.status=p_trip_status)
      and (p_trip_search='' or strpos(lower(concat_ws(' ',t.departure,t.destination,
        o.business_name,t.province)),lower(p_trip_search))>0
        or exists(select 1 from public.transport_trip_stops s where s.trip_id=t.id
          and strpos(lower(s.location),lower(p_trip_search))>0))
  ),
  trip_rows as (
    select t.id,t.operator_name,t.departure,t.destination,t.province,t.departure_at,
      t.departure_timezone,t.status,t.capacity,t.updated_at,
      (select jsonb_build_object('vehicle_type',v.vehicle_type,'registration_number',v.registration_number)
        from public.transport_vehicles v where v.id=t.vehicle_id) as vehicle,
      (select count(*) from public.transport_reservations r where r.trip_id=t.id and r.status='confirmed') as bookings,
      (select coalesce(sum(r.quantity),0) from public.transport_reservations r
        where r.trip_id=t.id and r.status='confirmed') as seats_reserved,
      (select min(s.remaining) from public.wantok_admin_transport_segments_v1 s where s.trip_id=t.id) as remaining_seats,
      coalesce((select jsonb_agg(jsonb_build_object('position',s.position,'location',s.location,
        'arrival_at',s.arrival_at,'departure_at',s.departure_at) order by s.position)
        from public.transport_trip_stops s where s.trip_id=t.id),'[]'::jsonb) as stops,
      coalesce((select jsonb_agg(jsonb_build_object('position',s.position,
        'reserved',s.reserved,'remaining',s.remaining) order by s.position)
        from public.wantok_admin_transport_segments_v1 s where s.trip_id=t.id),'[]'::jsonb) as segments
    from filtered_trips t order by t.departure_at desc,t.id limit 25 offset p_trip_page*25
  ),
  days as (select p_start+i as day from generate_series(0,p_end-p_start) i),
  daily as (
    select d.day::text as date,
      (select count(*) from public.transport_reservations r
        where r.created_at>=d.day::timestamp at time zone 'UTC'
          and r.created_at<(d.day+1)::timestamp at time zone 'UTC') as bookings,
      (select count(*) from public.transport_operators o
        where o.created_at>=d.day::timestamp at time zone 'UTC'
          and o.created_at<(d.day+1)::timestamp at time zone 'UTC') as registrations,
      (select count(*) from public.transport_reservations r
        where r.status in ('cancelled','trip_cancelled')
          and r.cancelled_at>=d.day::timestamp at time zone 'UTC'
          and r.cancelled_at<(d.day+1)::timestamp at time zone 'UTC') as cancellations
    from days d
  ),
  routes as (
    select t.departure||' -> '||t.destination as label,
      count(*) as count,
      (select count(*) from public.transport_reservations r join period_trips pt on pt.id=r.trip_id
        where pt.departure=t.departure and pt.destination=t.destination and r.status='confirmed') as bookings
    from period_trips t group by t.departure,t.destination
    order by bookings desc,count(*) desc,t.departure,t.destination limit 20
  ),
  origins as (select departure as label,count(*) as count from period_trips
    group by departure order by count(*) desc,departure limit 20),
  destinations as (select destination as label,count(*) as count from period_trips
    group by destination order by count(*) desc,destination limit 20),
  by_operator as (
    select o.business_name as label,count(*) as count from period_trips t
    join public.transport_operators o on o.id=t.operator_id
    group by o.id,o.business_name order by count(*) desc,o.id limit 20
  ),
  occupancy as (
    select coalesce(sum(s.reserved),0) as reserved,coalesce(sum(s.capacity),0) as capacity
    from public.wantok_admin_transport_segments_v1 s join period_trips t on t.id=s.trip_id
    where t.status<>'cancelled'
  )
  select jsonb_build_object(
    'version',2,'status','available','generated_at',statement_timestamp(),
    'period',jsonb_build_object('start',p_start,'end',p_end),
    'metrics',jsonb_build_object(
      'total_operators',(select count(*) from public.transport_operators),
      'pending_operators',(select count(*) from public.transport_operators where status='pending'),
      'approved_operators',(select count(*) from public.transport_operators where status='approved'),
      'active_trips',(select count(*) from public.transport_trips t
        where t.status='published' and t.departure_at<=now() and
          (select s.arrival_at from public.transport_trip_stops s where s.trip_id=t.id
            order by s.position desc limit 1)>now()),
      'upcoming_trips',(select count(*) from public.transport_trips where status='published' and departure_at>now()),
      'total_bookings',(select count(*) from public.transport_reservations),
      'seats_reserved',(select coalesce(sum(quantity),0) from public.transport_reservations where status='confirmed'),
      'available_seats',(select coalesce(sum(q.remaining),0) from (
        select min(s.remaining) as remaining from public.wantok_admin_transport_segments_v1 s
        join public.transport_trips t on t.id=s.trip_id
        join public.transport_operators o on o.id=t.operator_id
        where t.status='published' and o.status='approved' and s.departure_at>now()
        group by t.id) q),
      'completed_trips',(select count(*) from public.transport_trips where status='completed'),
      'cancelled_trips',(select count(*) from public.transport_trips where status='cancelled')
    ),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.date) from daily d),'[]'::jsonb),
    'routes',coalesce((select jsonb_agg(to_jsonb(r)) from routes r),'[]'::jsonb),
    'origins',coalesce((select jsonb_agg(to_jsonb(r)) from origins r),'[]'::jsonb),
    'destinations',coalesce((select jsonb_agg(to_jsonb(r)) from destinations r),'[]'::jsonb),
    'by_operator',coalesce((select jsonb_agg(to_jsonb(r)) from by_operator r),'[]'::jsonb),
    'occupancy',(select to_jsonb(o) from occupancy o),
    'outcomes',jsonb_build_object(
      'completed',(select count(*) from period_trips where status='completed'),
      'cancelled',(select count(*) from period_trips where status='cancelled')),
    'operators',jsonb_build_object('page',p_operator_page,'total',(select count(*) from filtered_operators),
      'rows',coalesce((select jsonb_agg(to_jsonb(o)) from operator_rows o),'[]'::jsonb)),
    'trips',jsonb_build_object('page',p_trip_page,'total',(select count(*) from filtered_trips),
      'rows',coalesce((select jsonb_agg(to_jsonb(t)) from trip_rows t),'[]'::jsonb)),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (
      select id,actor_id,target_kind,target_id,old_status,new_status,reason,created_at
      from public.wantok_transport_admin_audit order by created_at desc,id limit 50) a),'[]'::jsonb)
  ) into result;
  return result;
end;
$fn$;

create function public.wantok_admin_transport_decide_v1(
  p_actor_id uuid,p_actor_email text,p_kind text,p_target_id uuid,
  p_expected_status text,p_expected_updated_at timestamptz,p_status text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare o public.transport_operators; t public.transport_trips; previous text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Server access required' using errcode='42501';
  end if;
  if p_actor_id is null or p_actor_email is null or length(trim(p_actor_email))=0
    or p_target_id is null or p_kind is null or p_kind not in ('operator','trip')
    or p_status is null or p_expected_status is null or p_expected_updated_at is null
    or p_reason is null or length(trim(p_reason)) not between 1 and 500 then
    raise exception 'Invalid transport decision' using errcode='22023';
  end if;
  if p_kind='operator' then
    select * into o from public.transport_operators where id=p_target_id for update;
    if o.id is null or o.status is distinct from p_expected_status
      or o.updated_at is distinct from p_expected_updated_at then
      raise exception 'Operator changed; refresh before reviewing' using errcode='40001';
    end if;
    if p_status not in ('approved','rejected') or p_status=o.status then
      raise exception 'Unsupported operator transition' using errcode='22023';
    end if;
    -- Different projects have different auth UUIDs; compare verified email too.
    if o.user_id=p_actor_id or exists(select 1 from auth.users u where u.id=o.user_id
      and lower(trim(u.email))=lower(trim(p_actor_email))) then
      raise exception 'Self review is not permitted' using errcode='42501';
    end if;
    previous:=o.status;
    perform public.transport_review_operator(o.id,p_status,trim(p_reason));
  else
    -- Match existing operator->trip lock ordering to avoid booking/rejection deadlocks.
    select operator_id into t.operator_id from public.transport_trips where id=p_target_id;
    perform 1 from public.transport_operators where id=t.operator_id for update;
    select * into t from public.transport_trips where id=p_target_id for update;
    if t.id is null or t.status is distinct from p_expected_status
      or t.updated_at is distinct from p_expected_updated_at then
      raise exception 'Trip changed; refresh before moderating' using errcode='40001';
    end if;
    if t.status<>'published' or p_status not in ('cancelled','completed') then
      raise exception 'Unsupported trip transition' using errcode='22023';
    end if;
    if p_status='completed' and exists(
      select 1 from public.transport_reservations r join public.transport_trip_stops s on s.id=r.from_stop_id
      where r.trip_id=t.id and r.status='confirmed' and s.departure_at>now()) then
      raise exception 'Cannot complete a trip with confirmed future boardings' using errcode='22023';
    end if;
    previous:=t.status;
    update public.transport_trips set status=p_status,updated_at=now() where id=t.id;
    if p_status='cancelled' then perform public.transport_cancel_trip_reservations(t.id); end if;
  end if;
  insert into public.wantok_transport_admin_audit(actor_project,actor_id,target_kind,
    target_id,old_status,new_status,reason)
  values('fticsjeytmepljtkfrvm',p_actor_id,p_kind,p_target_id,previous,p_status,trim(p_reason));
  return jsonb_build_object('version',1,'status','saved');
end;
$fn$;

revoke all on function public.wantok_admin_transport_snapshot_v1(date,date,text,text,integer,text,text,integer)
  from public,anon,authenticated;
revoke all on function public.wantok_admin_transport_decide_v1(uuid,text,text,uuid,text,timestamptz,text,text)
  from public,anon,authenticated;
grant execute on function public.wantok_admin_transport_snapshot_v1(date,date,text,text,integer,text,text,integer)
  to service_role;
grant execute on function public.wantok_admin_transport_decide_v1(uuid,text,text,uuid,text,timestamptz,text,text)
  to service_role;
-- Add only aggregate/directory read columns; do not broaden passenger access.
-- Existing inherited Supabase server-role grants are not silently revoked here.
grant select(id,business_name,display_name,contact_phone,province,operating_area,
  status,review_note,reviewed_at,created_at,updated_at) on public.transport_operators to service_role;
grant select(id,operator_id,vehicle_type,registration_number,passenger_capacity,is_registration_vehicle)
  on public.transport_vehicles to service_role;
grant select(id,operator_id,vehicle_id,departure,destination,province,departure_at,
  departure_timezone,status,capacity,updated_at) on public.transport_trips to service_role;
grant select(id,trip_id,position,location,arrival_at,departure_at)
  on public.transport_trip_stops to service_role;
grant select(trip_id,from_stop_id,to_stop_id,quantity,status,created_at,cancelled_at)
  on public.transport_reservations to service_role;
grant select(id,operator_id,name) on public.transport_saved_routes to service_role;
grant select(route_id,position,location) on public.transport_saved_route_stops to service_role;
commit;
