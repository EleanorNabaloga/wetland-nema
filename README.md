# Wetland Watch (Next.js)

Simple two-screen app: a reporter takes a photo of pollution, the phone records GPS, NEMA views it on a dashboard, and the reporter then unlocks a reward.

## Run it in VS Code

```bash
npm install
npm run dev          # http://localhost:3000  (reporter)   /dashboard  (NEMA)
```

Open `/dashboard` on a laptop and `/` on a phone. Reports are shared through the server, so different devices see the same data.

**Phone testing:** camera GPS and hashing need HTTPS (or localhost). Options: `npm run dev:https`, or a tunnel such as `cloudflared tunnel --url http://localhost:3000` / `ngrok http 3000`, then open the https address on the phone.

## Structure

```
app/page.js                    reporter screen (photo, GPS, send, tracker, reward)
app/dashboard/page.js          NEMA dashboard (list, photo, map, outcome)
app/api/reports/route.js       GET list, POST create (validated), DELETE demo reset
app/api/reports/[id]/route.js  GET one, PATCH view / outcome / claim
lib/db.js                      server-only JSON file store (data/, git-ignored)
lib/image.js  lib/hash.js      photo resize, SHA-256 fingerprint
app/globals.css                styles
archive/                       first, larger prototype
docs/design-spec.md            full spec
```

## Before real use (not done yet)

1. Login and roles for `/dashboard` and the API. It is open right now.
2. Replace `lib/db.js` with Postgres: `reports` table + separate encrypted `identity_vault` table, plus an `audit_log` table.
3. Photos should go to object storage, not the database. Sign evidence on the device with a key, not just a hash.
4. Offline queue (service worker + IndexedDB) so reports send when the signal returns; installable PWA (manifest + icons).
5. SMS/airtime provider for rewards; NEMA triage, SLA timers and ELMIS integration.
6. `next build` on a host with a writable disk, or after step 2 on any host (JSON files do not persist on serverless hosting).
