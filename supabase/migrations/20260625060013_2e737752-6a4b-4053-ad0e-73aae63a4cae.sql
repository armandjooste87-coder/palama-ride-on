
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.wallet_topup(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_topup(numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.wallet_withdraw(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw(numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_ride_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_ride_payment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ride_accept(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ride_accept(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ride_advance(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ride_advance(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.ride_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ride_cancel(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS profiles_select_ride_participant ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_ride_counterpart_profile(_ride_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  phone text,
  rating numeric,
  vehicle_label text,
  vehicle_plate text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides; other uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO r FROM public.rides WHERE rides.id = _ride_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ride not found'; END IF;
  IF auth.uid() = r.passenger_id THEN other := r.driver_id;
  ELSIF auth.uid() = r.driver_id THEN other := r.passenger_id;
  ELSE RAISE EXCEPTION 'forbidden';
  END IF;
  IF other IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.avatar_url,
           CASE WHEN r.status IN ('completed','cancelled') THEN NULL ELSE p.phone END,
           p.rating, p.vehicle_label, p.vehicle_plate
      FROM public.profiles p
     WHERE p.id = other;
END $$;

REVOKE ALL ON FUNCTION public.get_ride_counterpart_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ride_counterpart_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_profiles_guard_sensitive()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'cannot modify protected profile columns';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_sensitive ON public.profiles;
CREATE TRIGGER profiles_guard_sensitive
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_guard_sensitive();

REVOKE UPDATE ON public.profiles FROM authenticated, anon, PUBLIC;
GRANT UPDATE (full_name, avatar_url, vehicle_label, vehicle_plate, is_driver_online, phone)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS rides_insert_self_passenger ON public.rides;
REVOKE INSERT ON public.rides FROM authenticated, anon, PUBLIC;

CREATE OR REPLACE FUNCTION public.ride_request(
  _pickup_address text, _pickup_lat numeric, _pickup_lng numeric,
  _dropoff_address text, _dropoff_lat numeric, _dropoff_lng numeric,
  _ride_type text
) RETURNS public.rides
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rides;
  km numeric; mins int; fare numeric;
  base numeric; per_km numeric; per_min numeric;
  earth_r constant numeric := 6371;
  d_lat numeric; d_lng numeric; a numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF _pickup_lat IS NULL OR _pickup_lng IS NULL
     OR _dropoff_lat IS NULL OR _dropoff_lng IS NULL
     OR abs(_pickup_lat) > 90 OR abs(_dropoff_lat) > 90
     OR abs(_pickup_lng) > 180 OR abs(_dropoff_lng) > 180 THEN
    RAISE EXCEPTION 'invalid coordinates';
  END IF;
  IF _pickup_address IS NULL OR length(_pickup_address) > 200
     OR _dropoff_address IS NULL OR length(_dropoff_address) > 200 THEN
    RAISE EXCEPTION 'invalid address';
  END IF;

  IF    _ride_type = 'palama_x'  THEN base := 12; per_km := 6;  per_min := 1.2;
  ELSIF _ride_type = 'palama_xl' THEN base := 20; per_km := 9;  per_min := 1.5;
  ELSIF _ride_type = 'premium'   THEN base := 35; per_km := 14; per_min := 2.0;
  ELSE RAISE EXCEPTION 'invalid ride_type %', _ride_type;
  END IF;

  d_lat := radians(_dropoff_lat - _pickup_lat);
  d_lng := radians(_dropoff_lng - _pickup_lng);
  a := sin(d_lat/2)^2 + cos(radians(_pickup_lat)) * cos(radians(_dropoff_lat)) * sin(d_lng/2)^2;
  km := 2 * earth_r * asin(least(1, sqrt(a)));
  IF km > 500 THEN RAISE EXCEPTION 'distance too large'; END IF;

  mins := greatest(3, round(km * 2.2)::int);
  fare := round(greatest(base, base + km * per_km + mins * per_min)::numeric, 2);
  km := round(km::numeric, 2);

  IF EXISTS (
    SELECT 1 FROM public.rides
     WHERE passenger_id = auth.uid()
       AND status IN ('requested','matched','arriving','arrived','in_progress')
  ) THEN
    RAISE EXCEPTION 'you already have an active ride';
  END IF;

  INSERT INTO public.rides(
    passenger_id, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    ride_type, fare_lsm, distance_km, duration_min, status
  ) VALUES (
    auth.uid(), _pickup_address, _pickup_lat, _pickup_lng,
    _dropoff_address, _dropoff_lat, _dropoff_lng,
    _ride_type, fare, km, mins, 'requested'
  ) RETURNING * INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.ride_request(text,numeric,numeric,text,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ride_request(text,numeric,numeric,text,numeric,numeric,text) TO authenticated;
