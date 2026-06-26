import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_BROWSER_KEY, GOOGLE_MAPS_TRACKING_ID } from "@/lib/maps.config";
import { DEFAULT_LOCATION } from "@/lib/palama";
import { MockMap } from "./MockMap";

interface Props {
  center?: { lat: number; lng: number };
  pickup?: { lat: number; lng: number } | null;
  dropoff?: { lat: number; lng: number } | null;
  driver?: { lat: number; lng: number } | null;
  showNearbyDrivers?: boolean;
  routeProgress?: number;
}

let loaderPromise: Promise<typeof google> | null = null;
function loadGoogle(): Promise<typeof google> {
  if (!loaderPromise) {
    const loader = new Loader({
      apiKey: GOOGLE_MAPS_BROWSER_KEY ?? "",
      version: "weekly",
      libraries: ["places"],
      channel: GOOGLE_MAPS_TRACKING_ID,
    });
    loaderPromise = loader.load();
  }
  return loaderPromise;
}

/**
 * Drop-in replacement for MockMap using Google Maps JS.
 * Falls back to MockMap if the connector browser key is not configured.
 */
export function GoogleMap({
  center = DEFAULT_LOCATION,
  pickup,
  dropoff,
  driver,
  showNearbyDrivers = true,
  routeProgress,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const progressMarkerRef = useRef<google.maps.Marker | null>(null);
  const [failed, setFailed] = useState(false);

  // Init
  useEffect(() => {
    if (!GOOGLE_MAPS_BROWSER_KEY) { setFailed(true); return; }
    let cancelled = false;
    loadGoogle().then((g) => {
      if (cancelled || !ref.current) return;
      mapRef.current = new g.maps.Map(ref.current, {
        center,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        styles: DARK_STYLE,
      });
    }).catch((err) => {
      console.warn("[Palama] Google Maps failed to load, falling back to mock map", err);
      setFailed(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter on center change.
  useEffect(() => {
    if (mapRef.current && center) mapRef.current.panTo(center);
  }, [center?.lat, center?.lng]);

  // Pickup/dropoff markers and route line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const g = window.google;

    if (pickup) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new g.maps.Marker({
          map, position: pickup, icon: pinIcon(g, "#FFFFFF"), title: "Pickup",
        });
      } else pickupMarkerRef.current.setPosition(pickup);
    } else { pickupMarkerRef.current?.setMap(null); pickupMarkerRef.current = null; }

    if (dropoff) {
      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = new g.maps.Marker({
          map, position: dropoff, icon: pinIcon(g, "#D9F26B"), title: "Dropoff",
        });
      } else dropoffMarkerRef.current.setPosition(dropoff);
    } else { dropoffMarkerRef.current?.setMap(null); dropoffMarkerRef.current = null; }

    if (pickup && dropoff) {
      if (!routeLineRef.current) {
        routeLineRef.current = new g.maps.Polyline({
          map, path: [pickup, dropoff], strokeColor: "#D9F26B",
          strokeOpacity: 0.95, strokeWeight: 4,
        });
      } else routeLineRef.current.setPath([pickup, dropoff]);
      const b = new g.maps.LatLngBounds();
      b.extend(pickup); b.extend(dropoff);
      map.fitBounds(b, 80);
    } else { routeLineRef.current?.setMap(null); routeLineRef.current = null; }
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // Driver marker (live).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const g = window.google;
    if (driver) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new g.maps.Marker({
          map, position: driver, icon: carIcon(g), title: "Driver",
        });
      } else driverMarkerRef.current.setPosition(driver);
    } else { driverMarkerRef.current?.setMap(null); driverMarkerRef.current = null; }
  }, [driver?.lat, driver?.lng]);

  // Animated route progress marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google || !pickup || !dropoff || typeof routeProgress !== "number") {
      progressMarkerRef.current?.setMap(null);
      progressMarkerRef.current = null;
      return;
    }
    const g = window.google;
    const lat = pickup.lat + (dropoff.lat - pickup.lat) * routeProgress;
    const lng = pickup.lng + (dropoff.lng - pickup.lng) * routeProgress;
    if (!progressMarkerRef.current) {
      progressMarkerRef.current = new g.maps.Marker({
        map, position: { lat, lng }, icon: carIcon(g),
      });
    } else progressMarkerRef.current.setPosition({ lat, lng });
  }, [routeProgress, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  if (failed) {
    return (
      <MockMap center={center} pickup={pickup} dropoff={dropoff} driver={driver}
        showNearbyDrivers={showNearbyDrivers} routeProgress={routeProgress} />
    );
  }

  return <div ref={ref} className="h-full w-full" aria-label="Map" />;
}

function pinIcon(g: typeof google, fill: string): google.maps.Symbol {
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: "#0F1A2E",
    strokeWeight: 3,
  };
}
function carIcon(g: typeof google): google.maps.Symbol {
  return {
    path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 5,
    fillColor: "#D9F26B",
    fillOpacity: 1,
    strokeColor: "#0F1A2E",
    strokeWeight: 2,
  };
}

// Dark theme suited to Palama navy palette.
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#16223a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9fb1cc" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2f4f" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2a3d63" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a517a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1322" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];