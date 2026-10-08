# Wetland Watch (Next.js)

A reporting app for wetland pollution. A reporter takes a photo, the phone records GPS, and NEMA staff review the report on a protected dashboard. The reporter sees the outcome and can then unlock a reward.

## What it does

- **Reporter screen (`/`)**: photo, GPS, send, report tracker, reward.
- **Staff login with MFA**: officers sign in with email and password, then an authenticator (TOTP) code. New officers use "Request access" and an admin approves them.
- **Roles**: `admin`, `reviewer`, `inspector`, `legal`. API routes are protected with `requireRole`.
- **Reviewer dashboard (`/dashboard`)**: report list with photo, location and status, "Mark as reviewed", then a triage category and a next step the reporter sees.
- **SLA tracking**: reports left in `new` past the acknowledgement deadline show an "overdue" badge (`lib/sla.js`).
- **Hotspots**: groups reports into roughly 500 m grid cells and ranks them by report count. Reports with GPS accuracy worse than 500 m are excluded. Available at `/hotspots` and as a card component.
- **Admin staff page (`/admin/staff`)**: approve or reject officer access requests.
- **Audit log**: staff logins, MFA enrolment and report actions are recorded.
- **Translations**: UI text is kept in `lib/i18n.js` and `lib/strings/`.

## Run it in VS Code

```bash
npm install
npm run dev          # http://localhost:3001
```

Open `/dashboard` on a laptop and `/` on a phone. Reports are shared through the server, so different devices see the same data.

If port 3001 is busy, a dev server is already running. Stop it first (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Phone testing:** camera GPS and hashing need HTTPS (or localhost). Use a tunnel such as `cloudflared tunnel --url http://localhost:3001` or `ngrok http 3001`, then open the https address on the phone.

## Environment variables

Create `.env.local` in the project root. It is git-ignored. Never commit it.

| Variable                  | Purpose                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | Neon Postgres connection string (use the pooled `-pooler` host with `?sslmode=require`). If unset, the app falls back to local JSON files in `data/`. |
| `USE_LOCAL_DEMO_FALLBACK` | Set to `false` to stop falling back to JSON files.                                                                                                    |
| `DEFAULT_ADMIN_EMAIL`     | Email for the seeded admin account.                                                                                                                   |
| `DEFAULT_ADMIN_PASSWORD`  | Password for the seeded admin. Set a strong value. Do not rely on the built-in fallback.                                                              |
| `STAFF_USERS`             | Optional JSON array of extra staff accounts to seed.                                                                                                  |

The admin seed only runs when the `staff_users` table is empty. Changing these values later does not update an existing account. To reset a password, write a new bcrypt hash into `staff_users.password_hash` and set `totp_enabled = false`.

## Database

Data lives in Neon Postgres. Tables: `reports`, `staff_users`, `identity_vault`, `audit_log`. The schema is in `db/migrations/`. Run it in the Neon SQL Editor before first use.

`lib/db.js` is a custom data layer. It recognizes specific SQL shapes (such as `select ... from reports`) and answers them, and it uses JSON files in `data/` when `DATABASE_URL` is not set. New queries that it does not recognize can return empty results. For new features, query Postgres directly with the exported `getPool()` (as the hotspots route does).

Note: the database region matters for speed. A project in AWS US East 2 is slow from East Africa. For lower latency, create the Neon project in `eu-central-1`.

## Structure

```
app/page.js                       reporter screen (photo, GPS, send, tracker, reward)
app/dashboard/page.js             reviewer dashboard (list, triage, next step)
app/hotspots/page.js              ranked hotspot list
app/login/  app/mfa/  app/register/   staff sign in, MFA, access request
app/admin/staff/page.js           approve or reject staff
app/api/reports/route.js          list and create reports (role protected)
app/api/reports/[id]/route.js     view, review, triage, outcome, claim
app/api/hotspots/route.js         hotspot grouping query
app/api/auth/                     login, logout, MFA, register
app/api/admin/staff/route.js      staff approvals
app/api/upload/route.js           photo upload
components/HotspotList.js         hotspot card list
components/LogoutButton.js
lib/db.js                         data layer (Postgres, JSON fallback)
lib/session.js  lib/guard.js      sessions and requireRole
lib/totp.js  lib/secrets.js       MFA and secret handling
lib/sla.js                        triage categories and SLA timers
lib/i18n.js  lib/strings/         translations
lib/format.js
middleware.js                     redirects unauthenticated users to /login
public/sw.js                      service worker
db/migrations/                    SQL schema
docs/design-spec.md               full spec
app/globals.css                   styles
```

## Triage options

- **Categories**: Emergency, Enforcement, Referral, Duplicate, Insufficient. Emergency and Enforcement need an inspection.
- **Next steps**: Inspector will visit, Referred to another agency, Need more information.

## Security notes

- `.env.local` and `data/` must stay out of Git. `data/` can hold report photos, coordinates and identity data.
- `/api/hotspots` must have the same `requireRole` check as the other report routes before deployment. Add it if it is not there yet.
- Rotate the Neon password if it is ever exposed.
- Do not send anything from `identity_vault` to third-party services.

## Before real use (still to do)

1. Add the `requireRole` check to `/api/hotspots` and gate `/hotspots` in `middleware.js`.
2. Move photos to object storage instead of the database. Sign evidence on the device with a key, not just a hash.
3. Confirm the offline queue (service worker + IndexedDB) retries sends when the signal returns, and add the PWA manifest and icons.
4. SMS/airtime provider for rewards, and ELMIS integration.
5. Reduce latency: run independent queries in parallel, use the pooled connection, and host the database near users.
6. Deploy on a host with environment variables set. JSON files do not persist on serverless hosting, so `DATABASE_URL` is required there.
7. Planned: an AI helper that suggests triage category and next step for reviewers, with a human always confirming.

```

```
