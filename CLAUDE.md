# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commands

```bash
npm install && npm --prefix backend install   # deps (frontend + backend)
npm run dev                                   # Vite dev server, strictly on http://localhost:5173
npm --prefix backend run dev                  # Express backend on :5000 (node --watch)
npm run build                                 # production build -> dist/
npm --prefix backend test                     # auth/roles + leads/inbox + templates test suites (backend must be running)
npm --prefix backend run test:flow            # WhatsApp flow + webhook end-to-end (encrypted, with fake photo CDN)
npm --prefix backend run test:load            # seed 10 lakh leads and time the panel queries; seed:clean removes them
node wacto/check_flow_status.cjs              # live report: backend, tunnel, Meta flow, public key, WABA health
node wacto/deploy_meta_flow.cjs               # build + validate + publish a NEW flow version on Meta, writes WHATSAPP_FLOW_ID
```

MongoDB 8 must be running locally (Windows service "MongoDB", port 27017). Production uses the DigitalOcean Managed MongoDB cluster via `MONGO_URL` in `backend/.env`.

## Architecture

Vite + React 18 + Tailwind v4 frontend (`src/`) and an Express (ESM) backend (`backend/`) on MongoDB.

**Public site**: `src/App.jsx` routes; pages in `src/pages/`; member card component `src/components/MembershipCard.jsx`. The card page (`/membership-card?id=`) reads `GET /api/members/:id`, which stays public.

**Admin panel** (`/admin/*`, wrapped by `src/components/AdminLayout.jsx`): one login page `/admin/login` for two roles decided by the backend:
- `super_admin` — Dashboard, Members, Member Management, Bot Messages, Flow Simulator, plus CRM: Inbox, Leads, Incomplete Registrations, Templates.
- `super_super_admin` (Developer) — everything above plus DEVELOPER MODE: Providers, Webhook & Flow Logs, Flow Deploy, Admin Accounts, Audit Log (`/admin/dev/*`). The layout hides these and the backend returns 403 for the other role.
- Admin pages call the API through `apiFetch`/`apiJson` in `src/config/api.js`, which attaches the login token and redirects to login on 401.

**Backend** (`backend/`):
- `db/mongo.js` connection + indexes; `db/db.js` members data layer (async). `backend/data/members.json` is legacy and only imported once when the `members` collection is empty.
- `services/auth.js` scrypt passwords, HS256 tokens, `requireAuth(...roles)`. The two `.env` accounts (`ADMIN_*`, `SUPER_SUPER_ADMIN_*`) are re-seeded on every start; other admins live only in MongoDB.
- `services/leads.js` CRM: leads are created at first contact (WhatsApp "Hi", click-to-WhatsApp ad referral, Facebook Lead Ads, website draft, flow step). Status lifecycle: new → contacted → registration_started → incomplete (24h sweep) / registered → card_issued, or lost. All lists are server-paged and indexed (tested at 10 lakh rows).
- `services/templates.js` WhatsApp template builder validation (Meta limits), submit via Business Management API, status via `message_template_status_update` webhook + sync, send approved templates.
- `services/providers.js` one send interface with Meta (default, falls back to `WHATSAPP_*` env), WATI and WACTO adapters; active provider per purpose (`flow`, `transactional`, `marketing`).
- `services/audit.js` audit log for every admin mutation + webhook/flow event log (7-day TTL).
- `routes/whatsappWebhook.js` Meta Cloud API webhook (menus, cards, flow completion, template status, delivery statuses). `routes/flowEndpoint.js` encrypted WhatsApp Flows endpoint for the 4-step registration (photo decrypt from Meta CDN, server-side card render via `services/cardRenderer.js` with `@napi-rs/canvas`).
- `routes/leads.js`, `routes/templates.js`, `routes/dev.js` (developer only), `routes/members.js`, `routes/auth.js`.

**WhatsApp flow definition**: `wacto/build_flow_v2.cjs` generates `wacto/isydci_flow_v2.json` (Meta Flow JSON 6.0). Published flows cannot be edited; the deploy script always creates a new flow and updates `WHATSAPP_FLOW_ID`. The bot phone number belongs to WABA 3106462432894218 — flows must be created there.

## Deployment

Production is a DigitalOcean droplet (nginx + pm2) serving isydci.com with the API under `/api`. `.github/workflows/deploy.yml` runs the test suite on every push to `main` and, when the `DROPLET_*` secrets exist, runs `scripts/deploy_droplet.sh` on the droplet. `backend/.env` is never committed; the droplet keeps its own copy with the production `MONGO_URL` and WhatsApp keys. After deploying, re-point Meta with `node wacto/deploy_meta_flow.cjs --endpoint https://isydci.com/api/whatsapp/flow-endpoint`.
