## Palama — Stabilization & Feature Plan

### 1. Fix errors / warnings
- **Google Maps deprecation**: migrate `GoogleMap.tsx` from `google.maps.Marker` to `AdvancedMarkerElement` (load `marker` library, set `mapId`).
- **Dialog a11y warning**: add `DialogDescription` (or `aria-describedby`) to dialogs missing one (rating dialog in `ride.$id.tsx`, any others found during scan).
- Run `security--run_security_scan` and patch any new findings.

### 2. Profile page link fixes
- Audit `src/routes/profile.tsx`: ensure all `<Link>` targets use valid TanStack routes (Wallet, Activity, Admin if admin, Auth sign-out). Replace broken/missing routes with working ones, add missing routes if referenced (e.g. Saved Places, Help).

### 3. Payment methods at ride completion
- Add `payment_method` enum on `rides`: `wallet` (default), `cash`, `card_demo`.
- New sheet "Choose payment" shown to passenger before completion / on request. RPC `ride_set_payment_method(_ride_id, _method)` restricted to passenger and pre-completion.
- Extend `ride_settle` to skip wallet debit for `cash` (driver collects) but still record commission owed (driver wallet debited commission instead).

### 4. Pick up a friend (ride for someone else)
- Add columns `rider_name`, `rider_phone`, `is_for_friend` on `rides`.
- UI: toggle "Ride for someone else" in `PassengerHome` destination sheet → inputs for friend's name + phone. Driver sheet in `ride.$id.tsx` shows friend's info instead of passenger name.

### 5. Pay for a friend
- New RPC `wallet_transfer(_to_user, _amount, _note)`: SECURITY DEFINER, validates balance, inserts paired `transfer_out` / `transfer_in` rows.
- UI: "Send to a friend" card in `wallet.tsx` — phone lookup → confirm → transfer. Receipt slip on success.

### 6. Payment slip / receipt
- New `<ReceiptSlip />` component (printable, share via Web Share API). 
- Shown after ride completion (replacing/augmenting rating dialog flow) and after wallet transfer/top-up/withdraw. Includes: trip id, from/to, fare breakdown (base, commission %, driver share), payment method, timestamp (GMT+2), Palama branding.
- Add `/receipt/$rideId` route for re-viewing past slips from Activity.

### 7. Logging
- New `src/lib/logger.ts`: tiny wrapper with levels (`debug/info/warn/error`), tags route + user id, forwards to `reportLovableError` in prod for warn+error.
- Add `log_events` table (user_id, level, event, meta jsonb) + RPC `log_event` for server-recorded critical events (ride state changes, wallet ops, payment method changes).
- Wire logger into RPC call sites (`PassengerHome`, `ride.$id`, `wallet`, `DriverHome`, auth).

### 8. Env var checklist + Setup README
- `README.md` at project root:
  - Stack overview
  - Required env vars table:
    - Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `VITE_VAPID_PUBLIC_KEY`
    - Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `LOVABLE_API_KEY`
  - Local dev steps (`bun install`, `bun dev`)
  - Migration / admin bootstrap instructions
  - PWA install + push-notification setup
  - Deployment notes (Cloudflare Workers target)
- `.env.example` mirroring the checklist.

### Technical notes
- All new DB work goes through one migration (tables, columns, RPCs, GRANTs, RLS).
- All new RPCs `SECURITY DEFINER`, `EXECUTE` revoked from `anon`/`PUBLIC`, granted to `authenticated`.
- Receipt route is `noindex` and uses `get_ride_counterpart_profile` for the counterpart name.
- Logger never logs phone numbers, tokens, or wallet balances.

After implementation: rerun security scan and fix anything new.
