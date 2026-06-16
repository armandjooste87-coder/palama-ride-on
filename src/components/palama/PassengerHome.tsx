import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, MapPin, Star, ShieldAlert, Home as HomeIcon, Briefcase, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MockMap } from "./MockMap";
import { DEFAULT_LOCATION, MOCK_PLACES, RIDE_TYPES, type RideTypeKey, quoteFare, LSM, haversineKm } from "@/lib/palama";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function PassengerHome() {
  const { profile, user } = useAuth();
  const nav = useNavigate();
  const [pickup] = useState({ ...DEFAULT_LOCATION, label: "Current location" });
  const [destination, setDestination] = useState<(typeof MOCK_PLACES)[number] | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RideTypeKey>("palama_x");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);

  // Check for in-progress ride on mount.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("rides")
      .select("id")
      .eq("passenger_id", user.id)
      .in("status", ["requested", "matched", "arriving", "arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setActiveRideId(data.id); });
  }, [user]);

  const filtered = useMemo(
    () => MOCK_PLACES.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const km = destination ? haversineKm(pickup, destination) : 0;
  const quote = destination ? quoteFare(km, type) : null;

  async function requestRide() {
    if (!destination || !user || !quote) return;
    setRequesting(true);
    const { data, error } = await supabase
      .from("rides")
      .insert({
        passenger_id: user.id,
        pickup_address: pickup.label,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: destination.label,
        dropoff_lat: destination.lat,
        dropoff_lng: destination.lng,
        ride_type: type,
        fare_lsm: quote.fare,
        distance_km: quote.km,
        duration_min: quote.minutes,
        status: "requested",
      })
      .select("id")
      .single();
    setRequesting(false);
    if (error || !data) return toast.error(error?.message ?? "Could not request ride");
    setSheetOpen(false);
    nav({ to: "/ride/$id", params: { id: data.id } });
  }

  return (
    <>
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4 safe-top">
        <div>
          <p className="text-xs text-muted-foreground">Hello,</p>
          <h1 className="text-lg font-semibold">{profile?.full_name?.split(" ")[0] || "there"} 👋</h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1 rounded-full"
          onClick={() => { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); setSosOpen(true); }}
        >
          <ShieldAlert className="size-4" />
          SOS
        </Button>
      </header>

      {/* Map */}
      <div className="relative h-[55vh] w-full">
        <MockMap center={pickup} />
      </div>

      {activeRideId && (
        <Link
          to="/ride/$id"
          params={{ id: activeRideId }}
          className="mx-4 -mt-6 mb-3 flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground glow-primary"
        >
          <div>
            <p className="text-xs font-semibold opacity-80">RIDE IN PROGRESS</p>
            <p className="text-sm font-bold">Tap to resume tracking</p>
          </div>
          <ChevronRight className="size-5" />
        </Link>
      )}

      {/* Where to */}
      <div className="-mt-6 rounded-t-3xl bg-card px-5 pt-5">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-4 text-left">
              <Search className="size-5 text-muted-foreground" />
              <span className="text-base font-medium text-muted-foreground">Where to?</span>
              <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">Now</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl border-0 p-0">
            <SheetHeader className="px-5 pt-5">
              <SheetTitle>Plan your trip</SheetTitle>
            </SheetHeader>
            <div className="px-5 pt-3">
              <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-foreground" />
                  <span className="text-sm">{pickup.label}</span>
                </div>
                <div className="ml-1 h-3 w-px bg-border" />
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-sm bg-primary" />
                  <Input
                    autoFocus
                    placeholder="Search destination"
                    className="border-0 bg-transparent px-0 focus-visible:ring-0"
                    value={destination?.label ?? query}
                    onChange={(e) => { setDestination(null); setQuery(e.target.value); }}
                  />
                </div>
              </div>

              {!destination && (
                <ul className="mt-4 divide-y divide-border">
                  {filtered.map((p) => (
                    <li key={p.label}>
                      <button onClick={() => setDestination(p)} className="flex w-full items-center gap-3 py-3 text-left">
                        <div className="grid size-10 place-items-center rounded-full bg-surface-2">
                          <MapPin className="size-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">Maseru, Lesotho</p>
                        </div>
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">No matches.</li>
                  )}
                </ul>
              )}

              {destination && quote && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Choose a ride
                  </p>
                  {(Object.keys(RIDE_TYPES) as RideTypeKey[]).map((k) => {
                    const r = RIDE_TYPES[k];
                    const q = quoteFare(km, k);
                    return (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          type === k ? "border-primary bg-primary/10" : "border-border bg-surface-2"
                        }`}
                      >
                        <div className="text-3xl">{r.emoji}</div>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{r.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.minutes} min · {r.seats} seats · {r.tagline}
                          </p>
                        </div>
                        <p className="text-sm font-bold">{LSM(q.fare)}</p>
                      </button>
                    );
                  })}
                  <Button size="lg" className="w-full" disabled={requesting} onClick={requestRide}>
                    {requesting ? "Requesting…" : `Request ${RIDE_TYPES[type].label} — ${LSM(quote.fare)}`}
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <QuickAction icon={<HomeIcon className="size-4" />} label="Home" onClick={() => toast("Set home in Profile") } />
          <QuickAction icon={<Briefcase className="size-4" />} label="Work" onClick={() => toast("Set work in Profile")} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your trust score</h3>
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Star className="size-4 fill-primary text-primary" /> {profile?.rating?.toFixed(2) ?? "5.00"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Drivers see your rating before accepting trips.
        </p>

        <div className="mt-6 rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-4" /> Recent trips appear in Activity.
          </div>
        </div>
      </div>

      <Dialog open={sosOpen} onOpenChange={setSosOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Emergency SOS</DialogTitle>
            <DialogDescription>
              In production this notifies Palama Safety and shares your live location with your
              trusted contacts. Demo only — no call will be placed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setSosOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { toast.success("Safety team alerted (demo)"); setSosOpen(false); }}>
              Alert Safety Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-left">
      <div className="grid size-9 place-items-center rounded-full bg-card text-primary">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">Set address</p>
      </div>
    </button>
  );
}
