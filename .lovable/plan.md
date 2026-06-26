# Phase 2 — Palama

Big scope, so I'm grouping it into shippable chunks. Each is independently demoable; I'll build them in this order and re-run security + a smoke test at the end.

## Decisions baked in (tell me to change any)

- **Maps**: Google Maps JS via the existing `maps js key` connector (browser key). Geocoding/Directions go through the gateway server-side. Replaces `MockMap`.
- **Realtime location + chat**: Supabase Realtime (Postgres changes + broadcast channels). The Cloudflare Worker runtime can't host long-lived WebSocket servers, and Supabase Realtime is the supported equivalent — same UX, no custom WS infra.
- **Push notifications**: Web Push (VAPID) with a service worker. Phase 1 explicitly skipped a service worker; adding one now will enable installable PWA push on Android/desktop. iOS works only once the user installs to home screen (Apple limitation). I'll generate VAPID keys via `generate_secret`.
- **Document upload**: private Supabase Storage bucket `driver-docs`, RLS so drivers only see their own, admins see all. Doc types: driver_license, vehicle_registration, insurance, profile_photo. Status: pending / approved / rejected with admin note.
- **Wallet-to-wallet payment**: on ride completion, debit passenger wallet, credit driver wallet minus commission, credit platform ledger with the fee. Atomic in one SECURITY DEFINER function. Replaces the current "record two transactions" stub.
- **Commission**: per-driver column `commission_pct` (numeric, 2.00–35.00, default 35.00). Admin dashboard lets admins set it. Verification level (`unverified` / `basic` / `verified` / `premium`) is stored but doesn't auto-set the percentage — admin decides. I'll seed a hint table so admins see suggested ranges.
- **Admin dashboard**: new `/admin` route, gated by `has_role(auth.uid(), 'admin')`. Lists drivers, doc review queue, commission editor.

## Database (one migration)

- `profiles`: add `commission_pct numeric default 35.00 check (between 2 and 35)`, `verification_level text default 'unverified'`.
- `driver_documents`: id, driver_id, doc_type, storage_path, status, admin_note, reviewed_by, reviewed_at, timestamps. RLS: driver self + admin.
- `chat_messages`: id, ride_id, sender_id, body, created_at. RLS: only ride participants. Realtime publication enabled.
- `driver_locations`: driver_id pk, lat, lng, heading, updated_at. RLS: driver writes own; passenger of an active ride with that driver can read. Realtime enabled.
- `push_subscriptions`: user_id, endpoint, p256dh, auth, user_agent. RLS: own-row only.
- `platform_ledger`: id, ride_id, amount_lsm, kind ('commission'), created_at. Admin-readable.
- New `app_role` value `'admin'`. Grant admin to a chosen user via SQL helper.
- Replace `complete_ride_payment` with `ride_settle(_ride_id)`:
  - Locks the ride row, asserts status=completed and not already settled.
  - Reads passenger balance (profile + sum of txns), errors if insufficient.
  - Inserts: passenger `-fare` (`ride_payment`), driver `+fare*(1 - commission_pct/100)` (`ride_earning`), platform `+fare*commission_pct/100` into `platform_ledger`.
- Storage bucket `driver-docs` (private) + policies.

## Server functions / routes

- `src/lib/maps.functions.ts`: `geocode`, `routeBetween` via Google Maps gateway (server-side, using gateway secrets). Returns polyline + distance + duration.
- `src/lib/payments.functions.ts`: `settleRide` (calls `ride_settle` RPC; also called automatically when driver completes).
- `src/lib/admin.functions.ts`: `listDrivers`, `setCommission`, `setVerification`, `reviewDocument(approve|reject, note)`. All `requireSupabaseAuth` + admin check.
- `src/lib/push.functions.ts`: `savePushSubscription`, `sendPushToUser(user_id, payload)` using `web-push` (VAPID).
- `src/routes/api/public/push-test.ts`: webhook-style test endpoint (admin-only via header secret) for sanity-checking push.

## Frontend

- `src/components/palama/GoogleMap.tsx`: replaces `MockMap`. Loads JS API with `loading=async&callback=initMap&channel=...`, uses `google.maps.Map` + `google.maps.Marker` (no `mapId`, no AdvancedMarkerElement). Renders pickup/dropoff, animates driver marker from Realtime updates, draws Directions polyline.
- `src/components/palama/AddressAutocomplete.tsx`: Places API (New) `AutocompleteSuggestion.fetchAutocompleteSuggestions`. Replaces mock places list.
- `src/components/palama/ChatSheet.tsx`: bottom sheet on ride screen, Supabase Realtime channel per ride.
- `src/routes/profile.tsx`: driver-only "Documents" section with upload + status badges.
- `src/routes/admin.tsx` (+ child tabs): driver list, commission slider (2–35%), verification dropdown, doc review queue, platform earnings.
- Push: on first sign-in, prompt; register SW (`public/sw.js`); subscribe; store via `savePushSubscription`. Fire pushes on `ride matched`, `chat message`, `ride completed`.

## Out of scope this turn (will note in plan.md)

- Real SMS OTP (still mock — separate Twilio decision).
- M-Pesa top-up (still mock; wallet-to-wallet is real on-platform).
- iOS Safari push without home-screen install (Apple limitation).
- Background location tracking when app is backgrounded (browser limitation).

## Verification at the end

1. `bun run build` clean.
2. Security scan; fix anything new.
3. Playwright smoke: passenger requests → driver accepts → location stream visible → chat exchange → driver completes → wallet split correct (default 35%) → admin changes commission to 10% → next ride settles at 10%.

## Three quick questions before I start

1. **Custom domain for push?** Web Push works fine on `*.lovable.app`, but if you have a custom domain coming, subscriptions are bound to origin — switching domains later means users re-subscribe. OK to proceed on the preview domain?
2. **Who's the first admin?** I'll add an SQL one-liner `INSERT INTO user_roles (user_id, role) VALUES ('<your-uid>', 'admin')`. Want me to also expose a "promote to admin" button visible only when zero admins exist, so you can self-promote from the UI on first run?
3. **Document storage limit per driver** — cap at, say, 10 MB per file and 4 doc types max, or no limits for now?
