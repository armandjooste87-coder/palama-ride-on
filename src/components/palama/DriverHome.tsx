import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, TrendingUp, MapPin, Navigation } from "lucide-react";
import { MockMap } from "./MockMap";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LOCATION, LSM, MOCK_PLACES, RIDE_TYPES, quoteFare, haversineKm, type RideTypeKey } from "@/lib/palama";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface IncomingReq {
  pickup: (typeof MOCK_PLACES)[number];
  dropoff: (typeof MOCK_PLACES)[number];
  type: RideTypeKey;
}

export function DriverHome() {
  const { profile, user, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [online, setOnline] = useState(profile?.is_driver_online ?? false);
  const [incoming, setIncoming] = useState<IncomingReq | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(15);

  // Simulate incoming requests when online.
  useEffect(() => {
    if (!online) { setIncoming(null); return; }
    const id = setInterval(() => {
      if (incoming) return;
      const p = MOCK_PLACES[Math.floor(Math.random() * MOCK_PLACES.length)];
      let d = MOCK_PLACES[Math.floor(Math.random() * MOCK_PLACES.length)];
      if (d === p) d = MOCK_PLACES[(MOCK_PLACES.indexOf(p) + 1) % MOCK_PLACES.length];
      const types: RideTypeKey[] = ["palama_x", "palama_xl", "premium"];
      setIncoming({ pickup: p, dropoff: d, type: types[Math.floor(Math.random() * types.length)] });
      setSecondsLeft(15);
    }, 7000);
    return () => clearInterval(id);
  }, [online, incoming]);

  // Countdown for incoming request.
  useEffect(() => {
    if (!incoming) return;
    if (secondsLeft <= 0) { setIncoming(null); return; }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [incoming, secondsLeft]);

  const quote = useMemo(() => {
    if (!incoming) return null;
    return quoteFare(haversineKm(incoming.pickup, incoming.dropoff), incoming.type);
  }, [incoming]);

  async function toggleOnline(v: boolean) {
    setOnline(v);
    if (!user) return;
    await supabase.from("profiles").update({ is_driver_online: v }).eq("id", user.id);
    refreshProfile();
    toast(v ? "You're online — ready for rides" : "You're offline");
  }

  async function acceptRide() {
    if (!incoming || !user || !quote) return;
    // Find a waiting passenger ride or create a synthetic one (mock self-fulfilled match for demo).
    const { data: open } = await supabase
      .from("rides")
      .select("id")
      .eq("status", "requested")
      .is("driver_id", null)
      .neq("passenger_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let rideId = open?.id as string | undefined;
    if (rideId) {
      const { error: accErr } = await supabase.rpc("ride_accept", { _ride_id: rideId });
      if (accErr) { toast.error(accErr.message); return; }
    } else {
      // Demo: create a synthetic passenger-less ride owned by the driver to walk through the flow.
      const { data, error } = await supabase
        .from("rides")
        .insert({
          passenger_id: user.id,
          driver_id: user.id,
          pickup_address: incoming.pickup.label,
          pickup_lat: incoming.pickup.lat,
          pickup_lng: incoming.pickup.lng,
          dropoff_address: incoming.dropoff.label,
          dropoff_lat: incoming.dropoff.lat,
          dropoff_lng: incoming.dropoff.lng,
          ride_type: incoming.type,
          fare_lsm: quote.fare,
          distance_km: quote.km,
          duration_min: quote.minutes,
          status: "matched",
        })
        .select("id")
        .single();
      if (error || !data) { toast.error("Could not accept ride"); return; }
      rideId = data.id;
    }
    setIncoming(null);
    if (rideId) nav({ to: "/ride/$id", params: { id: rideId } });
  }

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4 safe-top">
        <div>
          <h1 className="sr-only">Palama — Drive and earn in Lesotho</h1>
          <p className="text-xs text-muted-foreground">Driver</p>
          <h2 className="text-lg font-semibold">{profile?.full_name?.split(" ")[0] || "Driver"}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5">
          <span className={`size-2 rounded-full ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs font-semibold">{online ? "ONLINE" : "OFFLINE"}</span>
          <Switch checked={online} onCheckedChange={toggleOnline} />
        </div>
      </header>

      <div className="relative h-[55vh] w-full">
        <MockMap center={DEFAULT_LOCATION} showNearbyDrivers={false} />
        {!online && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Card className="mx-6 max-w-xs p-6 text-center">
              <h2 className="text-lg font-bold">You're offline</h2>
              <p className="mt-1 text-sm text-muted-foreground">Go online to start receiving ride requests.</p>
              <Button className="mt-4 w-full" onClick={() => toggleOnline(true)}>Go Online</Button>
            </Card>
          </div>
        )}
      </div>

      <div className="-mt-6 flex-1 rounded-t-3xl bg-card px-5 pt-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<TrendingUp className="size-4" />} label="Today" value={LSM(0)} />
          <Stat icon={<Navigation className="size-4" />} label="Trips" value="0" />
          <Stat icon={<Star className="size-4 fill-primary text-primary" />} label="Rating" value={(profile?.rating ?? 5).toFixed(2)} />
        </div>
        <div className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm text-muted-foreground">
          Requests show as a card when you're online. You have 15 seconds to accept.
        </div>
      </div>

      {/* Incoming request card */}
      {incoming && quote && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-md px-4">
          <Card className="overflow-hidden p-0">
            <div className="bg-primary px-4 py-2 text-center text-xs font-bold text-primary-foreground">
              NEW REQUEST · {secondsLeft}s
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {RIDE_TYPES[incoming.type].label}
                </span>
                <span className="text-lg font-bold">{LSM(quote.fare)}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><MapPin className="size-4 text-foreground" /><span>{incoming.pickup.label}</span></div>
                <div className="flex gap-2"><MapPin className="size-4 text-primary" /><span>{incoming.dropoff.label}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">{quote.km} km · {quote.minutes} min</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIncoming(null)}>Decline</Button>
                <Button className="flex-1" onClick={acceptRide}>Accept</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
