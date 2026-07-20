
-- Passenger self-drive for demo: assigns caller as driver of their own requested ride
CREATE OR REPLACE FUNCTION public.demo_self_drive(_ride_id uuid)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.rides;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO r FROM public.rides WHERE id = _ride_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ride not found'; END IF;
  IF r.passenger_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status <> 'requested' OR r.driver_id IS NOT NULL THEN RETURN r; END IF;
  UPDATE public.rides
     SET driver_id = auth.uid(), status = 'matched'
   WHERE id = _ride_id
  RETURNING * INTO r;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.demo_self_drive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_self_drive(uuid) TO authenticated;

-- Driver-side demo: creates a ride with the caller as both passenger and driver in 'matched' state
CREATE OR REPLACE FUNCTION public.demo_driver_accept(
  _pickup_address text, _pickup_lat numeric, _pickup_lng numeric,
  _dropoff_address text, _dropoff_lat numeric, _dropoff_lng numeric,
  _ride_type text, _fare numeric, _distance_km numeric, _duration_min int
) RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.rides;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'only drivers'; END IF;
  IF _ride_type NOT IN ('palama_x','palama_xl','premium') THEN RAISE EXCEPTION 'invalid ride type'; END IF;
  INSERT INTO public.rides(
    passenger_id, driver_id, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    ride_type, fare_lsm, distance_km, duration_min, status
  ) VALUES (
    auth.uid(), auth.uid(), _pickup_address, _pickup_lat, _pickup_lng,
    _dropoff_address, _dropoff_lat, _dropoff_lng,
    _ride_type, _fare, _distance_km, _duration_min, 'matched'
  ) RETURNING * INTO r;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.demo_driver_accept(text,numeric,numeric,text,numeric,numeric,text,numeric,numeric,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_driver_accept(text,numeric,numeric,text,numeric,numeric,text,numeric,numeric,int) TO authenticated;
