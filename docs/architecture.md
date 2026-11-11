# Architecture

How Kuuma Obutonde works end to end. For setup, see the [README](../README.md). For each API route, see [api.md](api.md).

## The two apps

```
  Public (phone)                                   NEMA officers (laptop)
       |                                                   |
       v                                                   v
 +---------------------+                        +----------------------+
 | Reporter app        |                        | Staff dashboard      |
 | Wetland-watch       |                        | wetland-nema         |
 | Next.js, PWA        |                        | Next.js              |
 | port 3000           |                        | port 3001            |
 |                     |                        |                      |
 | - take photo, GPS   |                        | - login + MFA        |
 | - sign evidence     |                        | - review, triage     |
 | - duplicate checks  |                        | - deadlines (SLA)    |
 | - status, rewards   |                        | - trust, hotspots    |
 +----------+----------+                        +-----------+----------+
            |  creates reports                  reads and   |
            |  stores reward phone (encrypted)  updates     |
            v                                   reports     v
       +---------------------------------------------------------+
       |              Neon Postgres (one shared database)        |
       |  reports  identity_vault  duplicate_attempts  rate_limits|
       |  staff_users  audit_log  reporter_trust  trust_events    |
       +---------------------------------------------------------+
```

The apps never call each other. They only share the database. Both must use the same `DATABASE_URL`.

**Ownership rule:** the reporter app creates reports and owns everything the public sends. The dashboard only updates review fields (`status`, `viewed_at`, `reviewed_by`, `triage_category`, `triaged_*`, `inspected_*`, `outcome`, `decided_at`) and owns the staff, audit and trust tables.

## Signing in

```
/login  --email + password-->  POST /api/auth/login
                                 |
             MFA not needed -----+----- MFA needed (default)
                   |                         |
          session cookie (8 h)      short "pre" cookie (10 min)
                   |                         |
                   |                  /mfa  GET /api/auth/mfa
                   |                    first time: QR code to scan
                   |                         |
                   |                  POST /api/auth/mfa  (6-digit code)
                   |                         |
                   +------------> session cookie (8 h) --> /dashboard
```

- Session and pre-login cookies are signed tokens (HS256, `SESSION_SECRET`), `httpOnly`, `sameSite=strict`, and `secure` in production.
- Authenticator secrets are stored encrypted (AES-256-GCM, `MFA_ENCRYPTION_KEY`). Each code works once: the last used time step is saved, so a code cannot be replayed.
- `proxy.js` sends signed-out visitors of `/dashboard`, `/hotspots` and `/admin` to `/login`, oversight officers to `/hotspots` from anywhere else, and other non-admins away from `/admin`.
- Every API route calls `requireRole()` (`lib/guard.js`), which looks the officer up in `staff_users` on every request. Disabling an officer takes effect at once, even if their cookie is still valid.

## Report lifecycle and deadlines

Defined in `lib/sla.js`. Each stage's deadline counts from when the report was **received**.

```
 new  --Mark as reviewed-->  viewed
                               |
                     pick triage category
            +------------------+-------------------+
            |                                      |
   Emergency / Enforcement            Referral / Duplicate / Insufficient
            |                                      |
     Mark as inspected                             |
            |                                      |
            +-----------> pick next step <---------+
                          (outcome, decided_at)
                                 |
                                done
```

| Stage | Done when | Deadline from receipt |
| --- | --- | --- |
| Acknowledge | Marked as reviewed | 2 days |
| Triage | Category chosen | 7 days |
| Inspect (Emergency, Enforcement only) | Marked as inspected | 3 days for Emergency, 30 days for Enforcement |
| Decide | Next step chosen | 45 days |

These limits are placeholders to agree with NEMA before the pilot.

Rules the server enforces (`PATCH /api/reports/[id]`):

- A report must be reviewed before it can be triaged, inspected or given a next step.
- Inspection is only allowed for Emergency and Enforcement.
- The next step can be cleared again (which clears `decided_at`).
- Every change is written to `audit_log` in the same transaction.

## Evidence fields

What the dashboard shows about how trustworthy a photo is. All set by the reporter app.

| Field | Meaning |
| --- | --- |
| `hash` | Fingerprint of the photo taken on the phone |
| `signature_status` | `verified`: signed by the phone's key and checked on arrival. `unsigned`: older phone. Empty: sent before signature checks. |
| `device_public_key` | Anonymous key, one per phone. Also used as the reporter's identity for trust scores. |
| `source` | Taken live in the app, or chosen from the gallery (flagged) |
| `location_source`, `time_source` | Where the location and time came from (GPS, photo data, phone clock) |
| `acc` | GPS accuracy in metres |
| `dup_status`, `dup_of`, `case_id` | Duplicate check result from the reporter app: `accept`, `group` (same incident, shares a case), `flag` (photo may be reused) |

## Reporter trust score

`lib/trust.js`. One score per phone (`device_public_key`), from 0 to 100, starting at 40.

| Event | Trigger | Change |
| --- | --- | --- |
| `report_verified` | Triaged as Emergency, Enforcement or Referral | +3, smaller as the score grows |
| `duplicate_upload` | Triaged as Duplicate | -10 |
| `report_false` | Officer clicks "Mark as false report" | -20 |
| none | Triaged as Insufficient | no change (not the reporter's fault) |

Each report changes the score only once, except that marking a report false always counts, even after it was verified.

| Level | Rule |
| --- | --- |
| `restricted` | score below 20 |
| `new` | fewer than 5 verified reports |
| `trusted` | score 70 or more |
| `standard` | everyone else |

A failure in the trust score never blocks the review itself: it is logged and the review goes ahead.

## Hotspots

`lib/hotspots.js`, run on the server by `GET /api/hotspots`. Oversight officers get the result without report ids, so they never receive individual reports.

1. Only **reviewed** reports with GPS accuracy of 250 m or better count.
2. Reports are grouped into 500 m squares.
3. Each report is weighted by type (sewage and chemicals 8; burning, drainage, encroachment, wildlife, vegetation 4; rubbish and plastic 2; other 1) and halves in weight every 14 days.
4. Extra reports from the same phone in the same square count only 10%, so one person cannot create a hotspot alone.
5. Squares scoring under 4 are hidden. 16 or more is red, 8 or more orange, otherwise yellow. A square with only one reporter is always yellow.
6. Trend compares the last 14 days with the 14 before: worsening, steady or improving.

Weights and limits are constants at the top of the file.

## Demo mode

With no `DATABASE_URL` (or `USE_LOCAL_DEMO_FALLBACK=true`), `lib/db.js` stores everything in `data/*.json`. It answers only the SQL statements the app already uses, by matching their shape. New queries need a matching branch in `jsonQuery()` or they return nothing in demo mode. Demo mode is for a single developer machine only: files do not persist on serverless hosts.

## Performance choices

- The report list leaves out photos (they were about 97% of its size). The dashboard loads each photo from `/api/reports/[id]/photo`, which the browser keeps for a day.
- The dashboard refreshes the list every 30 seconds.
- The Postgres pool is kept on `global` so it is reused across requests and hot reloads.
