import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/palama/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LSM, RIDE_TYPES, type RideTypeKey } from "@/lib/palama";
import { MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Palama" },
      {
        name: "description",
        content:
          "Review your recent Palama trips, fares paid, and driver earnings — all in one place.",
      },
      { property: "og:title", content: "Your trips — Palama" },
      {
        property: "og:description",
        content: "See every Palama ride you've taken or driven, with status and fare details.",
      },
      { property: "og:url", content: "https://palama-co-ls.lovable.app/activity" },
    ],
    links: [{ rel: "canonical", href: "https://palama-co-ls.lovable.app/activity" }],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("rides")
      .select("*")
      .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRides(data ?? []);
        setLoading(false);
      });
  }, [user]);

  return (
    <AppShell>
      <header className="px-5 pt-8 safe-top">
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted-foreground">Your recent trips</p>
      </header>
      <div className="px-5 pt-4">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && rides.length === 0 && (
          <div className="mt-16 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-2">
              <MapPin className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 font-semibold">No trips yet</p>
            <p className="text-sm text-muted-foreground">Your bookings will show up here.</p>
          </div>
        )}
        <ul className="divide-y divide-border">
          {rides.map((r) => (
            <li key={r.id}>
              <Link to="/ride/$id" params={{ id: r.id }} className="flex items-center gap-3 py-4">
                <div className="grid size-11 place-items-center rounded-2xl bg-surface-2 text-xl">
                  {RIDE_TYPES[r.ride_type as RideTypeKey].emoji}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-semibold">{r.dropoff_address}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })} ·{" "}
                    {r.status.replace("_", " ")}
                  </p>
                </div>
                <p className="text-sm font-bold">{LSM(Number(r.fare_lsm))}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
