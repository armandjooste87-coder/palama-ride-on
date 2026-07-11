-- Payment method enum + new columns on rides
DO $$ BEGIN
  CREATE TYPE public.ride_payment_method AS ENUM ('wallet','cash','card_demo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS payment_method public.ride_payment_method NOT NULL DEFAULT 'wallet',
  ADD COLUMN IF NOT EXISTS is_for_friend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rider_name text,
  ADD COLUMN IF NOT EXISTS rider_phone text;

-- Extend txn_type with new values
DO $$ BEGIN ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'ride_commission_cash'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'transfer_in'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'transfer_out'; EXCEPTION WHEN others THEN NULL; END $$;

-- Log events
CREATE TABLE IF NOT EXISTS public.log_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level text NOT NULL CHECK (level IN ('debug','info','warn','error')),
  event text NOT NULL,
  route text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.log_events TO authenticated;
GRANT ALL ON public.log_events TO service_role;
ALTER TABLE public.log_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own logs read" ON public.log_events;
CREATE POLICY "own logs read" ON public.log_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own logs insert" ON public.log_events;
CREATE POLICY "own logs insert" ON public.log_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_event(_level text, _event text, _route text, _meta jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _level NOT IN ('debug','info','warn','error') THEN RETURN; END IF;
  INSERT INTO public.log_events(user_id, level, event, route, meta)
  VALUES (auth.uid(), _level, left(_event, 200), left(_route, 200), _meta);
END $$;
REVOKE ALL ON FUNCTION public.log_event(text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_event(text,text,text,jsonb) TO authenticated;

-- Ride payment method setter
CREATE OR REPLACE FUNCTION public.ride_set_payment_method(_ride_id uuid, _method text)
RETURNS public.rides LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rides;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _method NOT IN ('wallet','cash','card_demo') THEN RAISE EXCEPTION 'invalid method'; END IF;
  SELECT * INTO r FROM public.rides WHERE id = _ride_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ride not found'; END IF;
  IF r.passenger_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'ride finalized'; END IF;
  UPDATE public.rides SET payment_method = _method::public.ride_payment_method
   WHERE id = _ride_id RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.ride_set_payment_method(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ride_set_payment_method(uuid,text) TO authenticated;

-- Wallet transfer
CREATE OR REPLACE FUNCTION public.wallet_transfer(_to_phone text, _amount numeric, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid; recipient uuid; bal numeric; recipient_name text;
BEGIN
  me := auth.uid();
  IF me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _to_phone IS NULL OR length(_to_phone) < 4 THEN RAISE EXCEPTION 'invalid recipient'; END IF;
  SELECT id, full_name INTO recipient, recipient_name FROM public.profiles WHERE phone = _to_phone LIMIT 1;
  IF recipient IS NULL THEN RAISE EXCEPTION 'recipient not found'; END IF;
  IF recipient = me THEN RAISE EXCEPTION 'cannot transfer to yourself'; END IF;
  SELECT COALESCE(p.wallet_balance,0) + COALESCE(
    (SELECT SUM(amount_lsm) FROM public.wallet_transactions WHERE user_id = me), 0)
    INTO bal FROM public.profiles p WHERE p.id = me;
  IF bal < _amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount_lsm, type, description)
  VALUES (me, -_amount, 'transfer_out', COALESCE(_note,'Sent to friend')||' → '||_to_phone);
  INSERT INTO public.wallet_transactions(user_id, amount_lsm, type, description)
  VALUES (recipient, _amount, 'transfer_in', COALESCE(_note,'Received from friend'));
  RETURN jsonb_build_object('recipient_id', recipient, 'recipient_name', recipient_name, 'amount', _amount);
END $$;
REVOKE ALL ON FUNCTION public.wallet_transfer(text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_transfer(text,numeric,text) TO authenticated;

-- Extend ride_request with friend params (drop old, create new signature)
DROP FUNCTION IF EXISTS public.ride_request(text,numeric,numeric,text,numeric,numeric,text);
CREATE OR REPLACE FUNCTION public.ride_request(
  _pickup_address text, _pickup_lat numeric, _pickup_lng numeric,
  _dropoff_address text, _dropoff_lat numeric, _dropoff_lng numeric,
  _ride_type text, _is_for_friend boolean DEFAULT false,
  _rider_name text DEFAULT NULL, _rider_phone text DEFAULT NULL
) RETURNS public.rides LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rides; km numeric; mins int; fare numeric;
  base numeric; per_km numeric; per_min numeric;
  earth_r constant numeric := 6371; d_lat numeric; d_lng numeric; a numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _pickup_lat IS NULL OR _pickup_lng IS NULL OR _dropoff_lat IS NULL OR _dropoff_lng IS NULL
     OR abs(_pickup_lat) > 90 OR abs(_dropoff_lat) > 90
     OR abs(_pickup_lng) > 180 OR abs(_dropoff_lng) > 180 THEN RAISE EXCEPTION 'invalid coordinates'; END IF;
  IF _pickup_address IS NULL OR length(_pickup_address) > 200
     OR _dropoff_address IS NULL OR length(_dropoff_address) > 200 THEN RAISE EXCEPTION 'invalid address'; END IF;
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
  IF EXISTS (SELECT 1 FROM public.rides WHERE passenger_id = auth.uid()
             AND status IN ('requested','matched','arriving','arrived','in_progress')) THEN
    RAISE EXCEPTION 'you already have an active ride';
  END IF;
  INSERT INTO public.rides(
    passenger_id, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    ride_type, fare_lsm, distance_km, duration_min, status,
    is_for_friend, rider_name, rider_phone
  ) VALUES (
    auth.uid(), _pickup_address, _pickup_lat, _pickup_lng,
    _dropoff_address, _dropoff_lat, _dropoff_lng,
    _ride_type, fare, km, mins, 'requested',
    COALESCE(_is_for_friend,false),
    CASE WHEN _is_for_friend THEN left(_rider_name,120) END,
    CASE WHEN _is_for_friend THEN left(_rider_phone,40) END
  ) RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.ride_request(text,numeric,numeric,text,numeric,numeric,text,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ride_request(text,numeric,numeric,text,numeric,numeric,text,boolean,text,text) TO authenticated;

-- Ride settle: add cash support
CREATE OR REPLACE FUNCTION public.ride_settle(_ride_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rides; pct numeric; driver_share numeric; commission numeric; bal numeric; method text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ride not found'; END IF;
  IF auth.uid() <> r.passenger_id AND auth.uid() IS DISTINCT FROM r.driver_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status <> 'completed' THEN RAISE EXCEPTION 'ride not completed'; END IF;
  IF r.driver_id IS NULL THEN RAISE EXCEPTION 'no driver assigned'; END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE ride_id = _ride_id
             AND type IN ('ride_payment','ride_earning','ride_commission_cash')) THEN RETURN; END IF;
  SELECT commission_pct INTO pct FROM public.profiles WHERE id = r.driver_id;
  pct := COALESCE(pct, 35.00);
  commission := round(r.fare_lsm * pct / 100.0, 2);
  driver_share := round(r.fare_lsm - commission, 2);
  method := COALESCE(r.payment_method::text, 'wallet');
  IF method = 'cash' THEN
    SELECT COALESCE(p.wallet_balance,0) + COALESCE(
      (SELECT SUM(amount_lsm) FROM public.wallet_transactions WHERE user_id = r.driver_id), 0)
      INTO bal FROM public.profiles p WHERE p.id = r.driver_id;
    IF bal < commission THEN RAISE EXCEPTION 'driver has insufficient wallet balance to cover platform fee'; END IF;
    INSERT INTO public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
    VALUES (r.driver_id, r.id, -commission, 'ride_commission_cash',
            'Cash trip fee ('||pct::text||'%) — '||r.pickup_address||' → '||r.dropoff_address);
    INSERT INTO public.platform_ledger(ride_id, amount_lsm, kind) VALUES (r.id, commission, 'commission');
  ELSE
    SELECT COALESCE(p.wallet_balance,0) + COALESCE(
      (SELECT SUM(amount_lsm) FROM public.wallet_transactions WHERE user_id = r.passenger_id), 0)
      INTO bal FROM public.profiles p WHERE p.id = r.passenger_id;
    IF bal < r.fare_lsm THEN RAISE EXCEPTION 'passenger has insufficient wallet balance'; END IF;
    INSERT INTO public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
    VALUES (r.passenger_id, r.id, -r.fare_lsm, 'ride_payment', 'Trip to '||r.dropoff_address);
    INSERT INTO public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
    VALUES (r.driver_id, r.id, driver_share, 'ride_earning',
            'Trip — '||r.pickup_address||' → '||r.dropoff_address||' (fee '||pct::text||'%)');
    INSERT INTO public.platform_ledger(ride_id, amount_lsm, kind) VALUES (r.id, commission, 'commission');
  END IF;
END $$;