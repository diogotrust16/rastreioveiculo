# FleetWatch

SaaS vehicle monitoring platform — real-time GPS tracking, geofences, alerts, and fleet management for logistics companies.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, HTTP + Socket.IO + TCP:5001)
- `pnpm --filter @workspace/vehicle-monitor run dev` — run the React frontend (port 26125)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run seed` — seed demo data (clients, users, vehicles, positions, alerts) — idempotent
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Leaflet maps, Socket.IO client
- API: Express 5, JWT auth, Socket.IO server
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — DB schema (users, vehicles, clients, positions, alerts, geofences)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — generated React Query hooks + Zod schemas
- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/api-server/src/lib/` — socket.ts, tcpServer.ts, alertService.ts
- `artifacts/vehicle-monitor/src/pages/` — dashboard, tracking, vehicles, alerts, geofences, clients, login

## Architecture decisions

- TCP server on port 5001 receives GPS tracker messages: `imei:xxx,lat:yyy,lon:zzz,speed:nnn,ignition:true\n`
- Socket.IO emits `vehicle:position` events to all connected clients when a new position arrives
- Alert service runs geofence checks (Haversine) and signal-lost monitoring every 5 minutes
- JWT access tokens (15m) + refresh tokens (7d) stored in localStorage on client
- Frontend uses React Query with generated hooks from OpenAPI spec

## Product

- **Dashboard** — real-time fleet stats (total/online/offline vehicles, unread alerts)
- **Tracking** — live map with all vehicle positions + historical route replay
- **Vehicles** — CRUD management with client assignment and last-known-position
- **Alerts** — filterable alert feed (speed, geofence, ignition, signal lost) with mark-as-read
- **Geofences** — map-based geofence creation per vehicle with click-to-place
- **Clients** — company management with vehicle count

## Demo credentials

- Admin: `admin@monitor.com` / `123456`
- Client: `client@monitor.com` / `123456`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- bcrypt requires `pnpm approve-builds` in some environments — it's listed as external in build.mjs
- Socket.IO path `/socket.io` must be in the API server's `artifact.toml` paths array for the proxy to forward WebSocket upgrades
- When seeding passwords, always use `pnpm --filter @workspace/api-server exec node -e "const bcrypt = require('bcrypt'); bcrypt.hash(...)..."` to get a real hash
- The vehicle-monitor's BASE_URL is `/` — wouter router base should be `""` (not `"/"`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
