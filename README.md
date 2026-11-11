# Kuuma Obutonde: NEMA staff dashboard

Kuuma Obutonde is a reporting system for pollution and damage to the environment on wet and dry land: wetlands, rivers, forests, streets, markets and slums. It has two apps that share one Postgres database:

| App | Repo | Who uses it | What it does |
| --- | --- | --- | --- |
| Reporter app | [`Wetland-watch`](https://github.com/EleanorNabaloga/Wetland-watch) (live at https://wetland-watch.vercel.app) | The public | Take a photo, attach location, send a report, check its status, claim a reward |
| **Staff dashboard (this repo)** | `wetland-nema` | NEMA officers | Sign in with MFA, review and triage reports, track deadlines, see hotspots, approve staff |

This app has no public way to send reports. Everyone who opens it is sent to the staff login page, which links members of the public to the reporter app.

More detail:

- [docs/architecture.md](docs/architecture.md): how the two apps fit together, the report lifecycle, trust scores and hotspots
- [docs/api.md](docs/api.md): every API route, who may call it, and what it returns
- [docs/design-spec.md](docs/design-spec.md): the product design the system is working towards
- `/help` in the running app: the officer guide (signing in and using the dashboard)

## Quick start

You need Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:3001
```

With no `.env.local`, the app runs in **demo mode**: data is kept in JSON files in `data/` and an admin account is created for you:

- email `admin@nema.gov`, password `NemaAdmin!123`
- Two-step login is on by default, so you will be asked to scan a QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). To skip this on your own machine, set `MFA_MODE=off` in `.env.local`.

There are no reports in demo mode until the reporter app writes some. To see real reports, point both apps at the same `DATABASE_URL`.

If port 3001 is busy, a dev server is already running. Stop it (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Testing on a phone:** use an HTTPS tunnel such as `cloudflared tunnel --url http://localhost:3001` or `ngrok http 3001` and open the https address on the phone.

## What it does

- **Staff login with MFA.** Email and password, then a 6-digit authenticator (TOTP) code. Repeated failures are blocked for 15 minutes. Sessions last 8 hours.
- **Request access.** New officers register at `/register` with an official email address. An admin approves them and picks their role at `/admin/staff`.
- **Reviewer dashboard (`/dashboard`).** List of the latest 500 reports with filters (All, New, Overdue). Open a report to see the photo, map location, GPS accuracy, evidence hash and signature status, then:
  1. **Mark as reviewed**
  2. pick a **triage category**: Emergency, Enforcement, Referral, Duplicate, Insufficient
  3. for Emergency and Enforcement, **mark as inspected**
  4. pick the **next step** the reporter sees: Inspector will visit, Referred to another agency, Need more information
- **Deadline (SLA) tracking.** Each report has a deadline for its current stage. Reports past it show an "overdue" badge. See [the lifecycle](docs/architecture.md#report-lifecycle-and-deadlines).
- **Warnings on weak evidence.** Photos picked from the phone gallery (not taken live) are flagged, and the dashboard shows how long before sending the photo was taken.
- **Reporter trust score.** Each reporter's phone has a score that rises when their reports are verified and drops for duplicates or false reports. Officers can mark a report as false.
- **Hotspots (`/hotspots`).** Groups reviewed reports into 500 m squares, weights them by how serious the problem is and how recent, and ranks them on a list and map. Worked out on the server, so oversight officers see totals without receiving any report.
- **Audit log.** Logins, MFA setup, opening a report, and every review, triage, inspection and outcome change is recorded with the officer's email.

## Roles

| Role | Can do |
| --- | --- |
| `reviewer` | See reports, review, triage, mark inspected, set next step, mark false |
| `inspector` | Same as reviewer |
| `legal` | See reports, photos, trust scores and hotspots (read only) |
| `oversight` | Hotspots only: totals per area, with no report ids, photos, notes or reporter details. Every other page sends them to `/hotspots`. |
| `admin` | Approve, reject and disable staff. Cannot see reports (kept separate on purpose) |

## Environment variables

Create `.env.local` in the project root. It is git-ignored. Never commit it.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | In production | Neon Postgres connection string. Use the pooled `-pooler` host with `?sslmode=require`. If unset, the app uses JSON files in `data/`. Must match the reporter app's. |
| `USE_LOCAL_DEMO_FALLBACK` | No | `true` forces JSON files even when `DATABASE_URL` is set. |
| `SESSION_SECRET` | In production | At least 32 random characters. Signs staff logins. The app refuses to sign anyone in without it. |
| `MFA_ENCRYPTION_KEY` | In production | 64 hex characters. Encrypts authenticator secrets. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `MFA_MODE` | No | `all` (default: every officer), `admin` (admins only) or `off` (local demos only). |
| `ALLOWED_EMAIL_DOMAIN` | No | Email domains allowed to request access, comma separated. Default `nema.gov`. |
| `DEFAULT_ADMIN_EMAIL` | No | Email of the first admin. Default `admin@nema.gov`. |
| `DEFAULT_ADMIN_PASSWORD` | In production | Password of the first admin. Without it no admin is created in production. |
| `STAFF_USERS` | No | JSON array of extra staff to create, e.g. `[{"email":"a@nema.gov","hash":"<bcrypt>","role":"reviewer"}]`. |
| `NEXT_PUBLIC_REPORTER_URL` | No | Address of the reporter app, linked from the login page. Default `https://wetland-watch.vercel.app`. |
| `ALLOW_DEMO_RESET` | No | `true` enables "clear all reports" outside production. Never set it on a real database. |

Staff accounts are only created when there are no staff yet. Changing these values later does not change existing accounts. To reset a password, write a new bcrypt hash into `staff_users.password_hash` and set `totp_enabled = false` so the officer sets up their authenticator again.

## Database

Data lives in Neon Postgres, shared with the reporter app.

| Table | Written by | Holds |
| --- | --- | --- |
| `reports` | Reporter app (creates), dashboard (review fields) | Photo, location, time, type, note, evidence hash and signature, duplicate check results, status and triage |
| `identity_vault` | Reporter app | Reporter contact details for rewards, kept apart from reports. The dashboard only reads `claimed`. |
| `staff_users` | Dashboard | Officers, roles, password hashes, encrypted MFA secrets |
| `audit_log` | Dashboard | Who did what to which report, and when |
| `reporter_trust`, `trust_events` | Dashboard | Trust scores. Created automatically on first use. |
| `duplicate_attempts` | Reporter app | Rejected duplicate uploads |
| `rate_limits` | Reporter app | Hashed sender keys and counts, shared by every server instance |

Run the migrations in the Neon SQL Editor (or with `psql "$DATABASE_URL" -f <file>`) in date order. Every file is safe to run more than once.

1. `wetland-nema/db/migrations/20260930_base_tables.sql`: `reports`, `identity_vault`, `staff_users`, `audit_log` (append-only)
2. `wetland-nema/db/migrations/20261001_shared_reporter_storage.sql`
3. `Wetland-watch/db/migrations/20261010_duplicate_detection.sql`
4. `wetland-nema/db/migrations/20261020_reporter_trust.sql`
5. `Wetland-watch/db/migrations/20261023_evidence_signature.sql`
6. `Wetland-watch/db/migrations/20261111_rate_limits.sql`

Together they rebuild the live database exactly (checked column by column and index by index in November 2026).

`lib/db.js` is a custom data layer. With a database it passes SQL to Postgres. In demo mode it recognizes specific SQL shapes and answers them from the JSON files, so **a new query it does not recognize returns nothing in demo mode**. For new features that need Postgres, use the exported `getPool()` directly.

The database region matters for speed. A project in AWS US East 2 is slow from East Africa. Create the Neon project in `eu-central-1` for lower latency.

### Helper scripts

Run with the database address set, e.g. `node --env-file=.env.local scripts/db-check.mjs`.

| Script | What it does |
| --- | --- |
| `scripts/db-check.mjs` | Shows which database is in use, report counts by status, and whether the migrations and trust table exist |
| `scripts/review-data.mjs` | Lists officer accounts (with MFA on/off) and all reports |
| `scripts/dup-check.mjs` | Shows duplicate check results for the newest 6 reports |
| `scripts/remove-placeholder-admin.mjs` | Deletes the `your-admin-email` placeholder account. Dry run unless you add `--confirm`. |

## Project structure

```
app/
  page.js                     sends visitors to the dashboard
  login/ mfa/ register/       staff sign in, authenticator step, access request
  dashboard/page.js           reviewer dashboard
  hotspots/page.js            ranked hotspot list and map
  admin/staff/page.js         approve, reject, disable staff
  help/page.js                officer guide
  api/                        see docs/api.md
components/
  HotspotList.js  HotspotMap.js  LogoutButton.js
lib/
  db.js                       data layer (Postgres, or JSON files in demo mode)
  session.js  guard.js        signed session cookies and requireRole()
  totp.js  secrets.js         authenticator codes and secret encryption
  sla.js                      triage categories, stages and deadlines
  trust.js                    reporter trust score
  hotspots.js                 hotspot scoring
  schema.js                   makes sure the signature columns exist
proxy.js                      sends signed-out users to /login, non-admins away from /admin
next.config.mjs               security headers
db/migrations/                SQL changes
scripts/                      database helper scripts
tests/                        node --test suites (npm test)
archive/                      first single-file version, kept for reference
docs/                         design spec, architecture, API reference
```

## Deploying

1. Create the Neon database (preferably `eu-central-1`) and run the migrations in order.
2. On the host (e.g. Vercel), set `DATABASE_URL`, `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`. Leave `MFA_MODE` unset (defaults to `all`) and `ALLOW_DEMO_RESET` unset.
3. `npm run build`, then `npm start` (or let the host build it).
4. Sign in as the admin, set up the authenticator, and approve the first officers.

JSON files do not persist on serverless hosting, so `DATABASE_URL` is required there.

## Security notes

- `.env.local` and `data/` must stay out of Git. `data/` can hold photos, locations and reporter identity data.
- Rotate the Neon password if it is ever exposed.
- Do not send anything from `identity_vault` to third-party services.
- Every page sends security headers that stop the dashboard being shown inside other sites and turn off camera, microphone and location access (`next.config.mjs`).
- Login and access-request rate limits are kept in server memory. On serverless hosting each instance has its own count, so treat them as a speed bump, not a guarantee.

## Tests

```bash
npm test
```

20 tests (Node's built-in runner, no database needed) covering report deadlines, hotspot scoring and authenticator codes.

## Fixed in November 2026

- Removed `/api/upload`, which had no login check and no callers, and the S3 packages it used.
- `oversight` now has hotspots-only access. Hotspot scoring moved to the server (`/api/hotspots`), so the page and the API use the same rules.
- Added the missing base-table migration and a record of the trust tables.
- Removed old edit scripts, `.before-*` backups, an unregistered service worker and an unused import.
- Added automated tests.

Still to build (from the design spec): photos in object storage instead of the database, SMS/airtime rewards, ELMIS integration, and an AI helper that suggests a triage category for a human to confirm.
