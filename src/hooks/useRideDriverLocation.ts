import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to a driver's live location via Supabase Realtime, plus an
 * initial fetch. Returns the latest position or null.
 */
export function useRideDriverLocation(driverId: string | null | undefined) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!driverId) { setPos(null); return; }
    let cancelled = false;

    supabase.from("driver_locations").select("lat,lng").eq("driver_id", driverId).maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setPos({ lat: Number(data.lat), lng: Number(data.lng) });
      });

    const channel = supabase
      .channel(`driver_loc_${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { lat?: number; lng?: number } | null;
          if (row && typeof row.lat === "number" && typeof row.lng === "number") {
            setPos({ lat: Number(row.lat), lng: Number(row.lng) });
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return pos;
}