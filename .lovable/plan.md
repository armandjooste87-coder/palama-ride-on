## Palama Ride-Hailing — Mobile PWA (Phase 1 MVP)

The full spec (6 user roles, M-Pesa, Twilio, WebSockets, S3, admin dashboards, document verification) is several weeks of work. I'll ship a polished, demoable MVP first as a mobile-optimized web app (PWA), then we iterate.

### Phase 1 scope (this build)

**Auth**
- Phone-number signup/login with **mocked OTP** (any 6 digits works in dev, code shown in toast). Wire-compatible with Twilio later.
- Role on profile: passenger or driver (toggle at signup).

**Passenger flow**
- Home screen: mock map (styled SVG/canvas, no API key), current location pin, nearby driver dots.
- "Where to?" → destination input with mock address suggestions.
- Ride type selector: PalamaX / PalamaXL / Premium with LSM fares (Haversine estimate).
- Request ride → searching state → driver matched (mock) → en-route → arrived → in-trip → completed.
- SOS button (haptic + confirm modal).
- Ride history + 5-star rating.

**Driver flow**
- Online/offline toggle.
- Incoming request card with accept/decline + 15s timer.
- Trip screen: pickup → dropoff steps, "Arrived" / "Start" / "Complete" buttons.
- Earnings summary (today/week).

**Wallet (mock)**
- Balance display in LSM, mock deposit/withdraw, transaction list.

**Design**
- Mobile-first, one-handed, dark default, Palama brand (deep navy + accent lime/teal).
- Bottom tab nav: Home · Activity · Wallet · Profile.
- Haptic-style micro-animations, safe-area padding, splash-style hero.
- PWA manifest + icons so it installs to home screen. No service worker / offline (per skill).

### Tech

- TanStack Start + React + Tailwind v4 + shadcn.
- Lovable Cloud for: auth (email/password under the hood, phone shown to user), Postgres tables for `profiles`, `rides`, `ratings`, `wallet_transactions`, `saved_places`, with RLS.
- `user_roles` table + `has_role()` per security rules.
- All "real-time" simulated via setInterval/state for now. Twilio/M-Pesa/WebSocket swap-in points clearly marked.

### Out of scope (Phase 2+)

Admin/Support/Sales dashboards, document upload + verification workflow, real maps, real OTP/SMS/email, real M-Pesa, real WebSocket location stream, in-app chat, push notifications, multi-vehicle management.

### Deliverable for this turn

Working PWA you can click through end-to-end on a phone-sized viewport: sign up as passenger, request a ride, watch it auto-progress, rate; sign out, sign in as driver, accept a ride, complete it, see earnings.
