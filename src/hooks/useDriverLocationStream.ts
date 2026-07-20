import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Driver-side hook: publishes the device geolocation to `driver_locations`
 * every ~5s while `enabled` is true. Falls back to a stationary mock when
 * geolocation is unavailable or denied.
 */
export function useDriverLocationStream(driverId: string | undefined, enabled: boolean) {
  const lastPushRef = useRef(0);

  useEffect(() => {
    if (!driverId || !enabled) return;
    let cancelled = false;
    let watchId: number | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function push(lat: number, lng: number, heading: number | null) {
      const now = Date.now();
      if (now - lastPushRef.current < 4000) return; // throttle
      lastPushRef.current = now;
      await supabase.from("driver_locations").upsert({
        driver_id: driverId!,
        lat,
        lng,
        heading,
        updated_at: new Date().toISOString(),
      });
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          void push(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? null);
        },
        () => {
          // fallback: drift around Maseru
          interval = setInterval(() => {
            const lat = -29.3151 + (Math.random() - 0.5) * 0.01;
            const lng = 27.4869 + (Math.random() - 0.5) * 0.01;
            void push(lat, lng, null);
          }, 5000);
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 },
      );
    } else {
      interval = setInterval(() => {
        const lat = -29.3151 + (Math.random() - 0.5) * 0.01;
        const lng = 27.4869 + (Math.random() - 0.5) * 0.01;
        void push(lat, lng, null);
      }, 5000);
    }

    return () => {
      cancelled = true;
      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      if (interval) clearInterval(interval);
    };
  }, [driverId, enabled]);
}
