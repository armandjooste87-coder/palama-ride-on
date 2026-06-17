import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, Phone, MessageSquare, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MockMap } from "@/components/palama/MockMap";
import { LSM, RIDE_TYPES, type RideTypeKey } from "@/lib/palama";
import type { Database } from "@/integrations/supabase/types";

type RideRow = Database["public"]["Tables"] extends Record<string, unknown> ? any : any;

export const Route = createFileRoute("/ride/$id")({
  head: () => ({ meta: [{ title: "Trip — Palama" }] }),
  component: RidePage,
});

const STATUS_FLOW = ["requested","matched","arriving","arrived","in_progress","completed"] as const;
type Status = typeof STATUS_FLOW[number] | "cancelled";

const STATUS_COPY: Record<Status, { title: string; sub: string }> = {
  requested:   { title: "Finding your driver…", sub: "Matching you with a nearby driver" },
  matched:     { title: "Driver assigned",       sub: "Your driver is on the way" },
  arriving:    { title: "Driver is arriving",    sub: "Look out for them at pickup" },
  arrived:     { title: "Driver has arrived",    sub: "Hop in when you're ready" },
  in_progress: { title: "On the way",            sub: "Enjoy the ride" },
  completed:   { title: "Trip complete",         sub: "Thanks for riding with Palama" },
  cancelled:   { title: "Trip cancelled",        sub: "This trip was cancelled" },
};

function RidePage() {
  const { id } = useParams({ from: "/ride/$id" });
  const { user, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [ride, setRide] = useState<RideRow | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 visual progress along route
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(5);

  // Load ride.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from("rides").select("*").eq("id", id).maybeSingle();
      if (!cancelled) setRide(data);
    }
    load();
    const t = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [id]);

  const isPassenger = ride && user && ride.passenger_id === user.id;
  const isDriver = ride && user && ride.driver_id === user.id;

  // Auto-advance status for passenger view (simulates real-time driver progress).
  useEffect(() => {
    if (!ride || !isPassenger || isDriver) return;
    if (ride.status === "completed" || ride.status === "cancelled") return;
    const next: Partial<Record<Status, Status>> = {
      requested: "matched",
      matched: "arriving",
      arriving: "arrived",
      arrived: "in_progress",
      in_progress: "completed",
    };
    const n = next[ride.status as Status];
    if (!n) return;
    const delay = ride.status === "in_progress" ? 6000 : 4000;
    const t = setTimeout(async () => {
      await supabase.from("rides").update({ status: n }).eq("id", ride.id);
      if (n === "completed") {
        // pay (passenger + driver) via SECURITY DEFINER fn
        await supabase.rpc("complete_ride_payment", { _ride_id: ride.id });
      }
    }, delay);
    return () => clearTimeout(t);
  }, [ride, isPassenger, isDriver]);

  // Animate route progress while in_progress.
  useEffect(() => {
    if (ride?.status !== "in_progress") return;
    setProgress(0);
    const t = setInterval(() => setProgress((p) => Math.min(1, p + 0.02)), 120);
    return () => clearInterval(t);
  }, [ride?.status]);

  const pickup = useMemo(() => ride && { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }, [ride]);
  const dropoff = useMemo(() => ride && { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng) }, [ride]);
  const driverPos = useMemo(() => {
    if (!ride || !pickup || !dropoff) return null;
    if (ride.status === "matched" || ride.status === "arriving") {
      // driver "approaching" pickup from south-east
      return { lat: pickup.lat - 0.006 * (ride.status === "matched" ? 1.2 : 0.5), lng: pickup.lng + 0.006 };
    }
    return null;
  }, [ride, pickup, dropoff]);

  if (!ride) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const status = ride.status as Status;
  const copy = STATUS_COPY[status];

  async function driverAdvance(to: Status) {
    await supabase.from("rides").update({ status: to }).eq("id", ride.id);
    if (to === "completed") {
      await supabase.rpc("complete_ride_payment", { _ride_id: ride.id });
      refreshProfile();
    }
  }

  async function cancelRide() {
    await supabase.from("rides").update({ status: "cancelled" }).eq("id", ride.id);
    toast("Ride cancelled");
    nav({ to: "/", replace: true });
  }

  async function submitRating() {
    if (!user) return;
    const rateeId = isPassenger ? ride.driver_id : ride.passenger_id;
    if (!rateeId) return;
    await supabase.from("ratings").insert({
      ride_id: ride.id, rater_id: user.id, ratee_id: rateeId, stars,
    });
    setRated(true);
    toast.success("Thanks for your rating!");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4 safe-top">
        <button onClick={() => nav({ to: "/" })} className="grid size-10 place-items-center rounded-full bg-card">
          <X className="size-5" />
        </button>
        <Button variant="destructive" size="sm" className="gap-1 rounded-full" onClick={() => toast("Safety alerted (demo)")}>
          <ShieldAlert className="size-4" /> SOS
        </Button>
      </div>

      <div className="relative h-[55vh] w-full">
        <MockMap
          center={pickup ?? undefined}
          pickup={pickup}
          dropoff={dropoff}
          driver={driverPos}
          routeProgress={status === "in_progress" ? progress : undefined}
          showNearbyDrivers={status === "requested"}
        />
      </div>

      <div className="-mt-6 flex-1 rounded-t-3xl bg-card px-5 pt-5 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{RIDE_TYPES[ride.ride_type as RideTypeKey].label}</p>
            <h2 className="mt-1 text-xl font-bold">{copy.title}</h2>
            <p className="text-sm text-muted-foreground">{copy.sub}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Fare</p>
            <p className="text-lg font-bold">{LSM(Number(ride.fare_lsm))}</p>
          </div>
        </div>

        {(status === "matched" || status === "arriving" || status === "arrived" || status === "in_progress") && (
          <Card className="mt-5 flex items-center gap-3 p-4">
            <div className="grid size-12 place-items-center rounded-full bg-primary text-2xl">🧑‍✈️</div>
            <div className="flex-1">
              <p className="font-bold">Lerato M.</p>
              <p className="text-xs text-muted-foreground">Toyota Corolla · A123-AB</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs">
                <Star className="size-3 fill-primary text-primary" /> 4.93
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" onClick={() => toast("Calling driver…")}><Phone className="size-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => toast("Chat opens here")}><MessageSquare className="size-4" /></Button>
            </div>
          </Card>
        )}

        <div className="mt-5 space-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
          <div className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-foreground" /><span>{ride.pickup_address}</span></div>
          <div className="ml-1 h-3 w-px bg-border" />
          <div className="flex gap-3"><span className="mt-1 size-2 rounded-sm bg-primary" /><span>{ride.dropoff_address}</span></div>
        </div>

        {/* Driver-only actions */}
        {isDriver && status !== "completed" && status !== "cancelled" && (
          <div className="mt-5 grid gap-2">
            {status === "matched" && <Button size="lg" onClick={() => driverAdvance("arriving")}>I'm on the way</Button>}
            {status === "arriving" && <Button size="lg" onClick={() => driverAdvance("arrived")}>I've arrived</Button>}
            {status === "arrived" && <Button size="lg" onClick={() => driverAdvance("in_progress")}>Start trip</Button>}
            {status === "in_progress" && <Button size="lg" onClick={() => driverAdvance("completed")}>Complete trip</Button>}
          </div>
        )}

        {/* Cancel for passenger pre-pickup */}
        {isPassenger && (status === "requested" || status === "matched") && (
          <Button variant="ghost" className="mt-3 w-full text-destructive" onClick={cancelRide}>
            Cancel ride
          </Button>
        )}
      </div>

      {/* Rating dialog */}
      <Dialog open={status === "completed" && !rated} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your {isPassenger ? "driver" : "passenger"}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-1 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setStars(n)}>
                <Star className={`size-9 transition ${n <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRated(true); nav({ to: "/" }); }}>Skip</Button>
            <Button onClick={async () => { await submitRating(); nav({ to: "/" }); }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
