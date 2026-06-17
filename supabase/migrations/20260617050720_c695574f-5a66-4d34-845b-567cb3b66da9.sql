drop policy if exists profiles_select_ride_participant on public.profiles;
create policy profiles_select_ride_participant
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.rides r
    where r.status not in ('completed','cancelled')
      and (
        (r.passenger_id = auth.uid() and r.driver_id = profiles.id) or
        (r.driver_id   = auth.uid() and r.passenger_id = profiles.id)
      )
  )
);

drop policy if exists ratings_insert_self on public.ratings;
create policy ratings_insert_participant
on public.ratings for insert to authenticated
with check (
  auth.uid() = rater_id
  and exists (
    select 1 from public.rides r
    where r.id = ratings.ride_id
      and r.status = 'completed'
      and (
        (rater_id = r.passenger_id and ratee_id = r.driver_id) or
        (rater_id = r.driver_id    and ratee_id = r.passenger_id)
      )
  )
);
create unique index if not exists ratings_unique_rater_per_ride
  on public.ratings(ride_id, rater_id);

drop policy if exists rides_update_participant on public.rides;

create or replace function public.ride_accept(_ride_id uuid)
returns public.rides
language plpgsql security definer set search_path = public as $$
declare r public.rides;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not public.has_role(auth.uid(), 'driver') then
    raise exception 'only drivers can accept rides';
  end if;
  update public.rides
     set driver_id = auth.uid(), status = 'matched'
   where id = _ride_id
     and driver_id is null
     and status = 'requested'
  returning * into r;
  if r.id is null then raise exception 'ride not acceptable'; end if;
  return r;
end $$;

create or replace function public.ride_advance(_ride_id uuid, _to text)
returns public.rides
language plpgsql security definer set search_path = public as $$
declare r public.rides; legal boolean := false;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into r from public.rides where id = _ride_id;
  if r.id is null then raise exception 'ride not found'; end if;
  if r.driver_id is distinct from auth.uid() then
    raise exception 'only the assigned driver may advance this ride';
  end if;
  legal :=
    (r.status = 'matched'     and _to = 'arriving') or
    (r.status = 'arriving'    and _to = 'arrived')  or
    (r.status = 'arrived'     and _to = 'in_progress') or
    (r.status = 'in_progress' and _to = 'completed');
  if not legal then raise exception 'illegal transition % -> %', r.status, _to; end if;
  update public.rides set status = _to where id = _ride_id returning * into r;
  if _to = 'completed' then
    perform public.complete_ride_payment(_ride_id);
  end if;
  return r;
end $$;

create or replace function public.ride_cancel(_ride_id uuid)
returns public.rides
language plpgsql security definer set search_path = public as $$
declare r public.rides;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into r from public.rides where id = _ride_id;
  if r.id is null then raise exception 'ride not found'; end if;
  if auth.uid() <> r.passenger_id and auth.uid() is distinct from r.driver_id then
    raise exception 'forbidden';
  end if;
  if r.status not in ('requested','matched','arriving','arrived') then
    raise exception 'ride cannot be cancelled in status %', r.status;
  end if;
  update public.rides set status = 'cancelled' where id = _ride_id returning * into r;
  return r;
end $$;

revoke all on function public.ride_accept(uuid)         from public;
revoke all on function public.ride_advance(uuid, text)  from public;
revoke all on function public.ride_cancel(uuid)         from public;
grant execute on function public.ride_accept(uuid)        to authenticated;
grant execute on function public.ride_advance(uuid, text) to authenticated;
grant execute on function public.ride_cancel(uuid)        to authenticated;