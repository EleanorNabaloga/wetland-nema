# API reference

All routes are under `/api`, take and return JSON, and rely on the `ww_staff` session cookie set at login. "Staff" below means the `reviewer`, `inspector` and `legal` roles. `oversight` may call only `/api/hotspots`.

Errors always look like `{ "error": "message" }`.

| Status | Meaning |
| --- | --- |
| 400 | Bad input |
| 401 | Not signed in, or role not allowed (read routes) |
| 403 | Role not allowed (write routes), or account not active |
| 404 | Not found |
| 409 | Not allowed in the report's current state |
| 429 | Too many attempts |
| 500 | Server error (details only in the server log) |

## Auth

### `POST /api/auth/register`
Request staff access. No login needed. Limit: 5 per IP per hour.

```json
{ "name": "Jane Officer", "email": "jane@nema.gov", "password": "at-least-12-chars" }
```

- Email domain must be in `ALLOWED_EMAIL_DOMAIN` (default `nema.gov`).
- Password 12 to 72 characters.
- Always answers `{ "ok": true }`, even if the email already exists, so it cannot be used to find accounts. The account starts as `pending`.

### `POST /api/auth/login`
```json
{ "email": "jane@nema.gov", "password": "..." }
```
- `{ "ok": true, "mfa": "none", "role": "reviewer" }`: signed in (MFA off for this role).
- `{ "ok": true, "mfa": "setup" | "verify" }`: go to `/mfa`. A 10-minute `ww_pre` cookie is set.
- 401 `Invalid login`, 403 `Account not active` (with `status`: `pending`, `rejected`, `disabled`).
- 5 failures per IP or per email block that key for 15 minutes.

### `GET /api/auth/mfa`
Needs the `ww_pre` cookie.
- `{ "mode": "verify" }` if the authenticator is set up.
- `{ "mode": "setup", "qr": "data:image/png...", "secret": "BASE32" }` the first time.

### `POST /api/auth/mfa`
```json
{ "code": "123456" }
```
Sets the 8-hour `ww_staff` session cookie and returns `{ "ok": true, "role": "..." }`. 5 wrong codes block for 15 minutes. A code already used returns 409.

### `POST /api/auth/logout`
Clears the session cookie.

## Reports

### `GET /api/reports` (staff)
Latest 500 reports, newest first. No photos: use `hasPhoto` and the photo route.

Fields: `id, lat, lng, acc, ts, type, note, hasPhoto, hash, signatureStatus, source, locationSource, timeSource, publicKey, status, outcome, viewedAt, reviewedBy, category, triagedAt, triagedBy, inspectedAt, inspectedBy, decidedAt, receivedAt, claimed`.

`ts` is when the photo was taken; `receivedAt` (milliseconds) is when the server got it. Deadlines count from `receivedAt`.

### `DELETE /api/reports` (reviewer, inspector)
Deletes **all** reports. Only works when `ALLOW_DEMO_RESET=true` and not in production. Otherwise 403.

### `GET /api/reports/[id]` (staff)
One report, including `photo` (data URL or link). Writes `OPENED_REPORT` to the audit log.

### `PATCH /api/reports/[id]` (reviewer, inspector)
Send any combination:

```json
{
  "view": true,
  "category": "Emergency",
  "inspected": true,
  "outcome": "Inspector will visit",
  "falseReport": true
}
```

| Field | Values | Rule |
| --- | --- | --- |
| `view` | `true` | Moves `new` to `viewed` |
| `category` | `Emergency`, `Enforcement`, `Referral`, `Duplicate`, `Insufficient` | Report must be reviewed |
| `inspected` | `true` | Reviewed, and category Emergency or Enforcement |
| `outcome` | `Inspector will visit`, `Referred to another agency`, `Need more information`, or `""` to clear | Report must be reviewed |
| `falseReport` | `true` | Lowers the reporter's trust score |

Changes run in one transaction with audit entries (`VIEWED_REPORT`, `TRIAGED`, `INSPECTED`, `UPDATED_OUTCOME`). Returns `{ "ok": true }`.

### `GET /api/reports/[id]/photo` (staff)
The photo as an image (cached privately for a day), or a redirect if it is stored as an https link.

## Trust

### `GET /api/trust?report=<id>` (staff)
Trust score of the phone that sent the report, or `null` if the report has no device key.

```json
{ "score": 46.2, "verifiedCount": 2, "level": "new", "markedFalse": false }
```

## Hotspots

### `GET /api/hotspots` (staff, oversight)
Ranked hotspots from the latest 5000 reports, scored on the server (rules in [architecture.md](architecture.md#hotspots)).

```json
{
  "hotspots": [
    { "rank": 1, "level": "red", "score": 24, "reportCount": 3, "reporterCount": 3,
      "singleSource": false, "trend": "worsening", "topType": "Sewage",
      "lastReportAt": 1794411570733, "lat": 0.3414, "lng": 32.54414,
      "ids": ["NEMA-101", "NEMA-102", "NEMA-103"] }
  ],
  "reporterKnown": true,
  "canOpenReports": true
}
```

For `oversight`, `ids` is left out and `canOpenReports` is `false`. `lat`/`lng` is the centre of the 500 m square, not a report's location.

## Admin

### `GET /api/admin/staff` (admin)
Up to 200 staff accounts, pending first: `email, name, role, status, createdAt, decidedBy, decidedAt`.

### `PATCH /api/admin/staff` (admin)
```json
{ "email": "jane@nema.gov", "action": "approve", "role": "reviewer" }
```

| Action | From status | To status |
| --- | --- | --- |
| `approve` (needs `role`: reviewer, inspector, legal, oversight) | pending, disabled | active |
| `reject` | pending | rejected |
| `disable` | active | disabled |

Admins cannot change their own account or other admin accounts.
