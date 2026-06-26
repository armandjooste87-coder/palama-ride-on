// Public Google Maps + VAPID configuration. Values are non-secret.
export const GOOGLE_MAPS_BROWSER_KEY =
  import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
export const GOOGLE_MAPS_TRACKING_ID =
  import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

// VAPID public key — safe to ship to the browser (private key stays on the server).
export const VAPID_PUBLIC_KEY =
  "BJvxgnypyd4HyIEDtVEunhUHfRDSncVHQvLFQmjLwSrYgpadsXpBjh_qWfcXYGUEIZiUyKw7nbLhvT06M7Wqngg";

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}