-- 1) Driver locations: UPDATE must also require the driver role.
drop policy if exists "driver updates own location" on public.driver_locations;
create policy "driver updates own location" on public.driver_locations
  for update to authenticated
  using (driver_id = auth.uid() and public.has_role(auth.uid(), 'driver'::app_role))
  with check (driver_id = auth.uid() and public.has_role(auth.uid(), 'driver'::app_role));

-- 2) Ratings: one rating per (ride, rater).
create unique index if not exists ratings_unique_per_rater
  on public.ratings (ride_id, rater_id);