import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server-side: deliver a Web Push to every active subscription of a user.
 * Uses web-push with VAPID. Caller must be authenticated; for now only the
 * user themselves or an admin may target a user_id (defensive — there are no
 * cross-user push triggers wired yet).
 */
export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; title: string; body: string; url?: string }) =>
    z.object({
      user_id: z.string().uuid(),
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(500),
      url: z.string().max(500).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Authorize: self or admin
    if (data.user_id !== context.userId) {
      const { data: isAdmin } = await context.supabase
        .rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (!isAdmin) throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", data.user_id);
    if (error) throw error;
    if (!subs?.length) return { sent: 0 };

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@palama.app",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: data.title, body: data.body, url: data.url ?? "/" }),
        );
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.warn("[push] send failed", code, (e as Error).message);
        }
      }
    }));
    return { sent };
  });