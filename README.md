# Palama

Ride-sharing PWA for Lesotho. Mobile-first, dark theme, wallet-native.

## Stack
- TanStack Start v1 (React 19 + Vite 7, SSR on Cloudflare Workers)
- Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase: Postgres, Auth, Realtime, Storage)
- Google Maps JS, Web Push (VAPID), Bun runtime/tooling

## Environment variables
See `.env.example`. Client (`VITE_*`) values go in the browser; server values (`SUPABASE_*`, `VAPID_*`, `LOVABLE_API_KEY`) go in the Worker env. On Lovable Cloud, runtime secrets are configured via the platform — do NOT commit real values.

| Name | Scope | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | client | yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | yes |
| `VITE_SUPABASE_PROJECT_ID` | client | yes |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | client | yes |
| `VITE_VAPID_PUBLIC_KEY` | client | optional (push) |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | server | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | server | admin ops |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | server | push |
| `LOVABLE_API_KEY` | server | optional AI |

## Local dev
```bash
bun install
bun dev   # http://localhost:8080
```

## First-run admin
The first signed-in user can self-promote (only while no admin exists):
```ts
await supabase.rpc("bootstrap_admin");
```

## Features
- Phone-OTP auth, passenger/driver/admin roles
- Real-time ride tracking (Google Maps + Realtime)
- In-app chat during active rides
- Wallet: top-up, withdraw, pay-a-friend transfer
- Ride payment methods: **Wallet** (default), **Cash**, **Card (demo)**
- Pick up / pay for a friend
- Per-driver commission 2–35% (default 35%)
- Printable/shareable slips after every wallet op and ride
- Web Push (VAPID)
- Driver document upload + admin review
- Structured logging (`log_events` + `src/lib/logger.ts`)

## Deployment
Cloudflare Workers via TanStack Start Vite build. No Node host required.