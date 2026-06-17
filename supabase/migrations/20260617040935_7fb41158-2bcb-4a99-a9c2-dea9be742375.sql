
-- 1. Profiles: restrict UPDATE columns (block wallet_balance/rating edits)
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, vehicle_label, vehicle_plate, is_driver_online, phone)
  ON public.profiles TO authenticated;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Profiles SELECT: hide phone numbers from strangers
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_select_ride_participant ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE (r.passenger_id = auth.uid() AND r.driver_id = profiles.id)
         OR (r.driver_id = auth.uid() AND r.passenger_id = profiles.id)
    )
  );

-- 3. Rides SELECT: scope unassigned visibility to drivers only
DROP POLICY IF EXISTS rides_select_participant ON public.rides;
CREATE POLICY rides_select_participant ON public.rides
  FOR SELECT TO authenticated USING (
    passenger_id = auth.uid()
    OR driver_id = auth.uid()
    OR (driver_id IS NULL AND public.has_role(auth.uid(), 'driver'::public.app_role))
  );

-- 4. user_roles: remove self-insert (prevents role escalation)
DROP POLICY IF EXISTS user_roles_insert_self ON public.user_roles;

-- 5. wallet_transactions: remove direct insert, replace with SECURITY DEFINER fns
DROP POLICY IF EXISTS txn_insert_self ON public.wallet_transactions;

CREATE OR REPLACE FUNCTION public.wallet_topup(_amount numeric)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_out public.wallet_transactions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  INSERT INTO public.wallet_transactions(user_id, amount_lsm, type, description)
  VALUES (auth.uid(), _amount, 'deposit', 'M-Pesa top-up (demo)')
  RETURNING * INTO row_out;
  RETURN row_out;
END $$;

CREATE OR REPLACE FUNCTION public.wallet_withdraw(_amount numeric)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_out public.wallet_transactions; bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  SELECT COALESCE(p.wallet_balance, 0) + COALESCE((
    SELECT SUM(amount_lsm) FROM public.wallet_transactions WHERE user_id = auth.uid()
  ), 0) INTO bal
  FROM public.profiles p WHERE p.id = auth.uid();
  IF bal IS NULL OR bal < _amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount_lsm, type, description)
  VALUES (auth.uid(), -_amount, 'withdrawal', 'M-Pesa withdrawal (demo)')
  RETURNING * INTO row_out;
  RETURN row_out;
END $$;

CREATE OR REPLACE FUNCTION public.complete_ride_payment(_ride_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO r FROM public.rides WHERE id = _ride_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ride not found'; END IF;
  IF auth.uid() <> r.passenger_id AND auth.uid() IS DISTINCT FROM r.driver_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF r.status <> 'completed' THEN RAISE EXCEPTION 'ride not completed'; END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE ride_id = _ride_id AND type = 'ride_payment') THEN
    RETURN;
  END IF;
  INSERT INTO public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
  VALUES (r.passenger_id, r.id, -r.fare_lsm, 'ride_payment', 'Trip to ' || r.dropoff_address);
  IF r.driver_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions(user_id, ride_id, amount_lsm, type, description)
    VALUES (r.driver_id, r.id, r.fare_lsm * 0.85, 'ride_earning',
            'Trip — ' || r.pickup_address || ' → ' || r.dropoff_address);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.wallet_topup(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_withdraw(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_ride_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_topup(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride_payment(uuid) TO authenticated;
