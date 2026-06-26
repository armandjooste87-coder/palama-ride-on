
-- 1. Add 'admin' to app_role enum if not present
do $$ begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid where t.typname='app_role' and e.enumlabel='admin') then
    alter type public.app_role add value 'admin';
  end if;
end $$;

-- 2. profiles: commission + verification
alter table public.profiles
  add column if not exists commission_pct numeric(5,2) not null default 35.00,
  add column if not exists verification_level text not null default 'unverified';

alter table public.profiles drop constraint if exists profiles_commission_pct_range;
alter table public.profiles add constraint profiles_commission_pct_range check (commission_pct between 2 and 35);

alter table public.profiles drop constraint if exists profiles_verification_level_valid;
alter table public.profiles add constraint profiles_verification_level_valid
  check (verification_level in ('unverified','basic','verified','premium'));

-- Update guard trigger to also protect new sensitive columns
create or replace function public.tg_profiles_guard_sensitive()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id is distinct from old.id
     or new.wallet_balance is distinct from old.wallet_balance
     or new.rating is distinct from old.rating
     or new.created_at is distinct from old.created_at
     or new.commission_pct is distinct from old.commission_pct
     or new.verification_level is distinct from old.verification_level then
    raise exception 'cannot modify protected profile columns';
  end if;
  return new;
end $$;

-- 3. driver_documents
create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('driver_license','vehicle_registration','insurance','profile_photo')),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, doc_type)
);
grant select, insert, update, delete on public.driver_documents to authenticated;
grant all on public.driver_documents to service_role;
alter table public.driver_documents enable row level security;

create policy "drivers view own docs" on public.driver_documents
  for select to authenticated using (driver_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "drivers insert own docs" on public.driver_documents
  for insert to authenticated with check (driver_id = auth.uid());
create policy "drivers update own pending docs" on public.driver_documents
  for update to authenticated using (driver_id = auth.uid() and status = 'pending')
  with check (driver_id = auth.uid() and status = 'pending');
create policy "admins update any doc" on public.driver_documents
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create trigger driver_documents_set_updated_at before update on public.driver_documents
  for each row execute function public.tg_set_updated_at();

-- 4. chat_messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_ride_id_idx on public.chat_messages(ride_id, created_at);
grant select, insert on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;

create policy "chat participants read" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.rides r where r.id = ride_id
            and (r.passenger_id = auth.uid() or r.driver_id = auth.uid()))
  );
create policy "chat participants send" on public.chat_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and exists (
      select 1 from public.rides r where r.id = ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
        and r.status in ('matched','arriving','arrived','in_progress')
    )
  );

alter publication supabase_realtime add table public.chat_messages;

-- 5. driver_locations
create table if not exists public.driver_locations (
  driver_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.driver_locations to authenticated;
grant all on public.driver_locations to service_role;
alter table public.driver_locations enable row level security;

create policy "driver writes own location" on public.driver_locations
  for insert to authenticated with check (driver_id = auth.uid() and public.has_role(auth.uid(),'driver'));
create policy "driver updates own location" on public.driver_locations
  for update to authenticated using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy "passenger reads active driver location" on public.driver_locations
  for select to authenticated using (
    driver_id = auth.uid()
    or exists (
      select 1 from public.rides r
       where r.driver_id = driver_locations.driver_id
         and r.passenger_id = auth.uid()
         and r.status in ('matched','arriving','arrived','in_progress')
    )
    or public.has_role(auth.uid(),'admin')
  );

alter publication supabase_realtime add table public.driver_locations;
alter table public.driver_locations replica identity full;

-- 6. push_subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7. platform_ledger
create table if not exists public.platform_ledger (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  amount_lsm numeric(10,2) not null,
  kind text not null default 'commission',
  created_at timestamptz not null default now()
);
grant select on public.platform_ledger to authenticated;
grant all on public.platform_ledger to service_role;
alter table public.platform_ledger enable row level security;
create policy "admins read ledger" on public.platform_ledger
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- 8. ride_settle replaces complete_ride_payment for wallet split
create or replace function public.ride_settle(_ride_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  r public.rides;
  pct numeric;
  driver_share numeric;
  commission numeric;
  bal numeric;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into r from public.rides where id = _ride_id for update;
  if r.id is null then raise exception 'ride not found'; end if;
  if auth.uid() <> r.passenger_id and auth.uid() is distinct from r.driver_id then
    raise exception 'forbidden';
  end if;
  if r.status <> 'completed' then raise exception 'ride not completed'; end if;
  if r.driver_id is null then raise exception 'no driver assigned'; end if;
  if exists (select 1 from public.wallet_transactions where ride_id = _ride_id and type = 'ride_payment') then
    return;
  end if;

  -- passenger balance check
  select coalesce(p.wallet_balance,0) + coalesce(
    (select sum(amount_lsm) from public.wallet_transactions where user_id = r.passenger_id), 0)
    into bal from public.profiles p where p.id = r.passenger_id;
  if bal < r.fare_lsm then
    raise exception 'passenger has insufficient wallet balance';
  end if;

  select commission_pct into pct from public.profiles where id = r.driver_id;
  pct := coalesce(pct, 35.00);
  commission := round(r.fare_lsm * pct / 100.0, 2);
  driver_share := round(r.fare_lsm - commission, 2);

  insert into public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
  values (r.passenger_id, r.id, -r.fare_lsm, 'ride_payment',
          'Trip to ' || r.dropoff_address);

  insert into public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
  values (r.driver_id, r.id, driver_share, 'ride_earning',
          'Trip — ' || r.pickup_address || ' → ' || r.dropoff_address
          || ' (fee ' || pct::text || '%)');

  insert into public.platform_ledger(ride_id, amount_lsm, kind)
  values (r.id, commission, 'commission');
end $$;

revoke execute on function public.ride_settle(uuid) from public, anon;
grant execute on function public.ride_settle(uuid) to authenticated;

-- Make ride_advance call ride_settle on completion
create or replace function public.ride_advance(_ride_id uuid, _to text)
returns public.rides language plpgsql security definer set search_path=public as $$
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
    perform public.ride_settle(_ride_id);
  end if;
  return r;
end $$;
revoke execute on function public.ride_advance(uuid, text) from public, anon;
grant execute on function public.ride_advance(uuid, text) to authenticated;

-- 9. bootstrap_admin: lets the very first user self-promote when no admin exists
create or replace function public.bootstrap_admin()
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'admin already exists';
  end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'admin')
  on conflict do nothing;
end $$;
revoke execute on function public.bootstrap_admin() from public, anon;
grant execute on function public.bootstrap_admin() to authenticated;

-- Admin RPCs
create or replace function public.admin_set_commission(_driver_id uuid, _pct numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  if _pct is null or _pct < 2 or _pct > 35 then raise exception 'commission must be between 2 and 35'; end if;
  update public.profiles set commission_pct = _pct where id = _driver_id;
end $$;
revoke execute on function public.admin_set_commission(uuid,numeric) from public, anon;
grant execute on function public.admin_set_commission(uuid,numeric) to authenticated;

create or replace function public.admin_set_verification(_driver_id uuid, _level text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  if _level not in ('unverified','basic','verified','premium') then raise exception 'invalid level'; end if;
  update public.profiles set verification_level = _level where id = _driver_id;
end $$;
revoke execute on function public.admin_set_verification(uuid,text) from public, anon;
grant execute on function public.admin_set_verification(uuid,text) to authenticated;

create or replace function public.admin_review_document(_doc_id uuid, _status text, _note text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  if _status not in ('approved','rejected','pending') then raise exception 'invalid status'; end if;
  update public.driver_documents
     set status = _status, admin_note = _note,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = _doc_id;
end $$;
revoke execute on function public.admin_review_document(uuid,text,text) from public, anon;
grant execute on function public.admin_review_document(uuid,text,text) to authenticated;

-- Admin-visible driver list
create or replace function public.admin_list_drivers()
returns table(
  id uuid, full_name text, phone text, rating numeric,
  commission_pct numeric, verification_level text,
  pending_docs bigint, approved_docs bigint, total_earnings numeric
) language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  return query
    select p.id, p.full_name, p.phone, p.rating, p.commission_pct, p.verification_level,
      (select count(*) from public.driver_documents d where d.driver_id = p.id and d.status='pending'),
      (select count(*) from public.driver_documents d where d.driver_id = p.id and d.status='approved'),
      coalesce((select sum(amount_lsm) from public.wallet_transactions w
                 where w.user_id = p.id and w.type='ride_earning'), 0)
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = 'driver'
    order by p.created_at desc;
end $$;
revoke execute on function public.admin_list_drivers() from public, anon;
grant execute on function public.admin_list_drivers() to authenticated;

-- Document upload helper RPC (records metadata after client uploads file to Storage)
create or replace function public.driver_doc_upsert(_doc_type text, _storage_path text)
returns public.driver_documents language plpgsql security definer set search_path=public as $$
declare row_out public.driver_documents;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not public.has_role(auth.uid(),'driver') then raise exception 'only drivers'; end if;
  if _doc_type not in ('driver_license','vehicle_registration','insurance','profile_photo') then
    raise exception 'invalid doc type';
  end if;
  insert into public.driver_documents(driver_id, doc_type, storage_path, status)
  values (auth.uid(), _doc_type, _storage_path, 'pending')
  on conflict (driver_id, doc_type) do update
    set storage_path = excluded.storage_path,
        status = 'pending', admin_note = null, reviewed_at = null, reviewed_by = null,
        updated_at = now()
  returning * into row_out;
  return row_out;
end $$;
revoke execute on function public.driver_doc_upsert(text,text) from public, anon;
grant execute on function public.driver_doc_upsert(text,text) to authenticated;

-- 10. Storage policies for driver-docs bucket
-- Files are stored as: driver-docs/<driver_id>/<doc_type>.<ext>
create policy "driver reads own doc files" on storage.objects
  for select to authenticated using (
    bucket_id = 'driver-docs'
    and (auth.uid()::text = (storage.foldername(name))[1]
         or public.has_role(auth.uid(),'admin'))
  );
create policy "driver uploads own doc files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'driver-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "driver updates own doc files" on storage.objects
  for update to authenticated using (
    bucket_id = 'driver-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "driver deletes own doc files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'driver-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
