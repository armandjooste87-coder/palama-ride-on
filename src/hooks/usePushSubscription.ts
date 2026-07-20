import { useEffect } from "react";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/maps.config";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registers the service worker and (lazily, on first call) subscribes the
 * browser to Web Push and saves the subscription server-side. Safe no-op when
 * notifications are unsupported, denied, or already saved this session.
 */
export function usePushSubscription(userId: string | undefined) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Returns a function the UI can call (e.g. on a "Enable notifications" tap)
  return async function enablePush() {
    if (!userId) return { ok: false, reason: "no_user" as const };
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return { ok: false, reason: "unsupported" as const };
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" as const };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "invalid_sub" as const };
    }
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false, reason: "db_error" as const, error };
    return { ok: true as const };
  };
}
