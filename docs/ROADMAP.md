# Product and Technical Roadmap: Kuuma Obutonde

This document provides a strictly verified status of all planned features for Kuuma Obutonde, derived exclusively from the project design specification (`docs/design-spec.md`), the AI specification and build order (`docs/ai.md`), and existing repository documentation.

---

## 1. Feature Status Matrix

| Feature | Source in Existing Docs | Current Status | Code Verification Reference |
| :--- | :--- | :--- | :--- |
| **Staff Dashboard with MFA** | `docs/design-spec.md` (NEMA action) | Completed | `app/dashboard/`, `app/login/`, `lib/totp.js`, `tests/totp.test.mjs` |
| **Device Evidence Signatures** | `docs/design-spec.md` (Track B) | Completed | `Wetland-watch/lib/evidence.js`, `lib/device.js`, `tests/evidence.test.mjs` |
| **Duplicate Photo Checks** | `docs/design-spec.md` (Dedupe) | Completed | `Wetland-watch/lib/dup/`, `tests/duplicate-detection.test.mjs` |
| **Whistleblower Vault (Zero-PII)** | `docs/design-spec.md` (Governance) | Completed | `identity_vault` table, AES-256-GCM encryption in `Wetland-watch/lib/crypto.js` |
| **Statutory SLA State Machine** | `docs/design-spec.md` (SLA timers) | Completed | `lib/sla.js`, `tests/sla.test.mjs` |
| **Hotspot Geospatial Clustering** | `docs/design-spec.md` (Community Signal) | Completed | `lib/hotspots.js`, `app/hotspots/`, `tests/hotspots.test.mjs` |
| **AI Severity Sorting (Job 1)** | `docs/ai.md` (Build order: Job 1) | Completed | `lib/ai/fallbackEngine.js`, `app/api/cron/ai-worker/`, `tests/ai_engine.test.mjs` |
| **Officer Sorting Feedback Loop** | `docs/ai.md` (Job 1: Sort by severity) | Completed | `app/api/reports/[id]/route.js` (`officer_action` accepted or overridden) |
| **Repository Merge Safeguards** | `docs/BRANCH_PROTECTION.md` | Completed | `.github/workflows/merge-guard.yml`, `.githooks/pre-push`, `CODEOWNERS` |
| **Object Storage for Photos** | `README.md` (Still to build) | Planned | Tracked in Phase 2 |
| **Automated Airtime Rewards** | `docs/design-spec.md` (Rewards) | Planned | Tracked in Phase 2 |
| **ELMIS API Integration** | `docs/design-spec.md` (NEMA action) | Planned | Tracked in Phase 2 |
| **Severity-Weighted Hotspots (Job 2)**| `docs/ai.md` (Build order: Job 2) | Planned | Tracked in Phase 2 |
| **Daily Briefing & Nudges (Job 3)** | `docs/ai.md` (Build order: Job 3) | Planned | Tracked in Phase 3 |
| **Reward Fraud Fingerprint (Job 4)** | `docs/ai.md` (Build order: Job 4) | Planned | Tracked in Phase 3 |
| **Inspector Assignment (Job 5)** | `docs/ai.md` (Build order: Job 5) | Planned | Tracked in Phase 3 |
| **Voice Note Transcription (Job 7)**| `docs/ai.md` (Build order: Job 7) | Planned | Tracked in Phase 4 |
| **Feature Phone IVR and USSD** | `docs/design-spec.md` (Track A) | Planned | Tracked in Phase 4 |
| **Chain-of-Custody Export** | `docs/design-spec.md` (NEMA action) | Planned | Tracked in Phase 4 |

---

## 2. Completed Capabilities Evidenced by Code

### A. Staff Review Dashboard and Multi-Factor Authentication
- **Documentation Reference**: `docs/design-spec.md` (NEMA action) and `docs/architecture.md`.
- **Implementation**:
  - `app/login/page.js` and `app/mfa/page.js`: Multi-step authentication flow.
  - `lib/totp.js`: RFC 6238 time-based one-time password verification with AES-256-GCM encrypted secrets and replay protection.
  - `tests/totp.test.mjs`: 6 unit tests validating token step drift and replay rejection.

### B. Hardware-Backed Device Evidence Signing
- **Documentation Reference**: `docs/design-spec.md` (Track B: Evidence-Grade Case).
- **Implementation**:
  - `Wetland-watch/lib/device.js`: Web Crypto API generating non-exportable ECDSA P-256 private keys in browser IndexedDB.
  - `Wetland-watch/lib/evidence.js`: Canonical evidence payload reconstruction and digital signature verification.
  - `Wetland-watch/tests/evidence.test.mjs`: 9 unit tests verifying signature integrity and tampering rejection.

### C. Multi-Stage Duplicate Photo Detection
- **Documentation Reference**: `docs/design-spec.md` (Backend: Dedupe).
- **Implementation**:
  - `Wetland-watch/lib/dup/`: Byte-level SHA-256 and 64-bit difference hashing (dHash) comparing visual structure across rotations and compression.
  - `Wetland-watch/tests/duplicate-detection.test.mjs`: 24 unit tests validating exact match, near-duplicate rejection, and case grouping within 300 meters.

### D. Whistleblower Anonymity and Identity Vault
- **Documentation Reference**: `docs/design-spec.md` (Reporter protection: safe channels, no retaliation).
- **Implementation**:
  - `identity_vault` database table: Strict architectural segregation of citizen payout numbers from incident reports.
  - `Wetland-watch/lib/crypto.js`: AES-256-GCM encryption for stored telephone numbers.
  - `app/api/reports/route.js`: Queries select only `COALESCE(i.claimed, false) AS claimed`, never exposing personal phone numbers to dashboard users.

### E. AI Severity Sorting Pipeline (Job 1)
- **Documentation Reference**: `docs/ai.md` (Build order: Job 1).
- **Implementation**:
  - `lib/ai/fallbackEngine.js`: 4-tier fallback system (Tier 1 Cloud REST, Tier 2 Local CPU small model, Tier 3 Luganda, Runyankole, Acholi, Kiswahili and English word rules, Tier 4 Base SLA type weights). Includes coordinate rounding (~110 meters) and contact detail scrubbing.
  - `db/migrations/20261115_ai_jobs_queue.sql`: Production DDL creating `ai_triage_queue` and `ai_assessments`.
  - `app/api/cron/ai-worker/route.js`: Non-blocking background worker with short-lived database leases.
  - `app/dashboard/page.js`: Surfaces helpful AI suggestion card and badge with one-click officer acceptance.
  - `app/api/reports/[id]/route.js`: Tracks officer agreement (`officer_action`: `accepted` or `overridden`) in `ai_assessments` and `audit_log`.
  - `tests/ai_engine.test.mjs`: 8 automated tests validating coordinate rounding, contact scrubbing, Luganda keywords, tier transitions, and empty input handling.

---

## 3. Specifications for Planned Features (Directly from Existing Docs)

### A. Object Storage for Incident Evidence Media
- **Source**: `wetland-nema/README.md` ("Still to build: photos in object storage instead of the database").
- **Requirement**: Move photo storage from PostgreSQL base64 text to private S3-compatible bucket storage (such as Cloudflare R2 or AWS S3 in `eu-central-1`) using short-lived presigned URLs.

### B. Automated Airtime Rewards via Telecom APIs
- **Source**: `docs/design-spec.md` (Feedback and incentives: "lottery-based airtime after verification") and `README.md` ("Still to build: SMS/airtime rewards").
- **Requirement**: Automated payout worker calling MTN and Airtel Uganda open payment APIs to disburse airtime micro-rewards to verified whistleblowers whose phone numbers are stored in `identity_vault`.

### C. ELMIS Regulatory API Middleware
- **Source**: `docs/design-spec.md` (NEMA action: "ELMIS API or middleware, not manual re-entry") and `README.md` ("Still to build: ELMIS integration").
- **Requirement**: Bi-directional integration with NEMA's Environmental Licensing Management Information System (ELMIS) to cross-reference active wetland permits and dispatch verified inspection packages.

### D. Severity-Weighted Hotspots and Summaries (AI Job 2)
- **Source**: `docs/ai.md` (Build order: "2. Severity-weighted hotspots (Job 2), then hotspot summaries").
- **Requirement**: Weight reports in `lib/hotspots.js` by AI severity (Critical 10, High 6, Medium 3, Low 1) instead of base type weights, generating a one-line summary for each top hotspot.

### E. Daily Managerial Briefing and Deadline Nudges (AI Job 3)
- **Source**: `docs/ai.md` (Build order: "3. Daily briefing and deadline nudges (Job 3)").
- **Requirement**: Automated daily morning briefing screen summarizing new Critical and High reports, impending SLA deadlines, and draft message templates for officers to review.

### F. Reward Fraud Keyed Fingerprinting (AI Job 4)
- **Source**: `docs/ai.md` (Build order: "4. Reward fraud checks: add phone_fingerprint to identity_vault").
- **Requirement**: Compute HMAC-SHA-256 `phone_fingerprint` next to the encrypted number to detect airtime farming across multiple phones without decrypting phone numbers.

### G. Multi-Channel Community Signal: Feature Phone IVR and USSD (Track A)
- **Source**: `docs/design-spec.md` (Track A: "toll-free 0800 IVR records voice; USSD only for menu/callback").
- **Requirement**: Dedicated 0800 toll-free telephone intake for non-smartphone users, with speech-to-text transcription fine-tuned for Luganda and Ugandan English.
