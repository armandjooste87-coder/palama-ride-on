
-- ===== Enums =====
create type public.app_role as enum ('passenger','driver','admin','support','sales','super_admin');
create type public.ride_status as enum ('requested','matched','arriving','arrived','in_progress','completed','cancelled');
create type public.ride_type as enum ('palama_x','palama_xl','premium');
create type public.txn_type as enum ('deposit','withdrawal','ride_payment','ride_earning','refund');

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  full_name text,
  avatar_url text,
  rating numeric(3,2) not null default 5.00,
  is_driver_online boolean not null default false,
  vehicle_label text,
  vehicle_plate text,
  wallet_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_all_auth" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using (auth.uid() = id);

-- ===== Roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_select_self" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "user_roles_insert_self" on public.user_roles for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ===== Rides =====
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid references auth.users(id) on delete set null,
  pickup_address text not null,
  pickup_lat numeric(10,7) not null,
  pickup_lng numeric(10,7) not null,
  dropoff_address text not null,
  dropoff_lat numeric(10,7) not null,
  dropoff_lng numeric(10,7) not null,
  ride_type ride_type not null default 'palama_x',
  status ride_status not null default 'requested',
  fare_lsm numeric(10,2) not null default 0,
  distance_km numeric(8,2) not null default 0,
  duration_min integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.rides to authenticated;
grant all on public.rides to service_role;
alter table public.rides enable row level security;
create policy "rides_select_participant" on public.rides for select to authenticated
  using (auth.uid() = passenger_id or auth.uid() = driver_id or driver_id is null);
create policy "rides_insert_self_passenger" on public.rides for insert to authenticated
  with check (auth.uid() = passenger_id);
create policy "rides_update_participant" on public.rides for update to authenticated
  using (auth.uid() = passenger_id or auth.uid() = driver_id or (driver_id is null and public.has_role(auth.uid(),'driver')));

-- ===== Ratings =====
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  ratee_id uuid not null references auth.users(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_id, rater_id)
);
grant select, insert on public.ratings to authenticated;
grant all on public.ratings to service_role;
alter table public.ratings enable row level security;
create policy "ratings_select_involved" on public.ratings for select to authenticated
  using (auth.uid() = rater_id or auth.uid() = ratee_id);
create policy "ratings_insert_self" on public.ratings for insert to authenticated with check (auth.uid() = rater_id);

-- ===== Wallet transactions =====
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ride_id uuid references public.rides(id) on delete set null,
  amount_lsm numeric(12,2) not null,
  type txn_type not null,
  description text,
  created_at timestamptz not null default now()
);
grant select, insert on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "txn_select_self" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id);
create policy "txn_insert_self" on public.wallet_transactions for insert to authenticated with check (auth.uid() = user_id);

-- ===== Saved places =====
create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address text not null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.saved_places to authenticated;
grant all on public.saved_places to service_role;
alter table public.saved_places enable row level security;
create policy "places_all_self" on public.saved_places for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== updated_at trigger =====
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_set_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger rides_set_updated before update on public.rides
  for each row execute function public.tg_set_updated_at();

-- ===== Auto-create profile on signup =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone', new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  insert into public.user_roles (user_id, role)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::app_role, 'passenger'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
