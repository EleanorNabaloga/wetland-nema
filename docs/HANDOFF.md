# Engineering Handoff: AI Subsystem and Repository Governance

This document provides a clear engineering handoff for the AI sorting subsystem, repository safeguards, and open-source infrastructure implemented in `wetland-nema`.

---

## 1. Contributor Scope and Core Architecture

The contributor was tasked with implementing the AI subsystem specified in Eleanor Nabaloga's design brief (`docs/ai.md`), establishing open-source standards, and hardening repository protections without modifying unaffected parts of the system.

### A. Core Architecture Diagram

```mermaid
flowchart TD
    Reporter["Wetland-watch: Citizen Report Submission"] --> Ingest["POST /api/reports"]
    Ingest --> Queue["ai_triage_queue Table"]

    subgraph BackgroundWorker["Asynchronous Background Execution"]
        CronTrigger["Cron Endpoint: /api/cron/ai-worker"]
        LeaseJob["Micro-Transaction Lease (under 15 ms)"]
        Engine["4-Tier AI Fallback Engine"]
        Writeback["Micro-Transaction Assessment Write (under 15 ms)"]

        CronTrigger --> LeaseJob
        LeaseJob --> Engine
        Engine --> Writeback
    end

    Queue --> LeaseJob
    Writeback --> Assessments["ai_assessments Table"]

    subgraph StaffReview["Staff Review Workflow"]
        Dashboard["Next.js Reviewer Dashboard"]
        OfficerAction["Officer Review Decision"]
        Audit["audit_log Table"]

        Assessments --> Dashboard
        Dashboard --> OfficerAction
        OfficerAction -->|Records accepted or overridden| Assessments
        OfficerAction -->|Appends immutable record| Audit
    end
```

---

## 2. Implemented Code Footprint

### A. Four-Tier AI Fallback Engine (`lib/ai/fallbackEngine.js`)
- **Tier 1 (Cloud Multimodal)**: Connects to multimodal APIs with strict timeout bounds (1,800 milliseconds).
- **Tier 2 (Decoupled Local Model)**: Local or containerized small model on CPU with zero internet dependencies.
- **Tier 3 (Rule-Based Matching)**: Regular expressions mapping Ugandan environmental terms in Luganda, Runyankole, Acholi, Kiswahili, and English (including *obutwa*, *amakolero*, *kazambi*, *obukyafu*, *lutobazi*, *okutema*, *ettaka*, *okuzimba*, *emiti*, *kasasiro*, and *ebiveera*).
- **Tier 4 (Base SLA Weights)**: Falls back to statutory type weights from `lib/sla.js` and `lib/hotspots.js`.
- **Privacy Protections**:
  - `roundCoordinates(lat, lng)` / `quantizeCoordinates(lat, lng)`: Rounds coordinates to 3 decimal places (~110 meters) prior to logging or external model checks.
  - `sanitizeCitizenNote(note)`: Scrubs Ugandan telephone numbers and email addresses.
  - Defensive null/empty input handling.

### B. Background Micro-Transaction Worker (`app/api/cron/ai-worker/route.js`)
- **Connection Safety**: Eliminates connection pooler timeouts by separating queue leasing, external model evaluation, and assessment storage into three distinct short transactions.
- **Lease Step**: Atomically updates up to 5 jobs from `pending` to `processing` with `locked_at = now()`.
- **Out-of-Band Execution**: Runs model evaluation outside open database transactions.
- **Write-Back Step**: Stores assessment in `ai_assessments` using `ON CONFLICT (report_id) WHERE is_latest = true DO UPDATE SET` and marks queue entry as `completed`.
- **Authentication**: Optional bearer token authentication via `CRON_SECRET`.

### C. Database Schemas (`db/migrations/20261115_ai_jobs_queue.sql`)
- `ai_triage_queue`: Tracks report processing status (`pending`, `processing`, `completed`, `failed`), retry attempts, and locks.
- `ai_assessments`: Stores severity, suggested category, suggested outcome, confidence score, urgency score, key evidence tags, short reasoning, and officer action tracking.

### D. Reviewer Dashboard UI (`app/dashboard/page.js`)
- **Queue Badge**: Displays a visual indicator (`Suggested: [Category]`) for unreviewed reports in the dashboard list.
- **Helpful Suggestion Card**: Surfaces severity, suggested category, confidence, and reasoning in the inspection panel.
- **One-Click Acceptance**: An "Accept [Category]" button applies the suggested category and records `officer_action = 'accepted'`.

### E. Officer Action Feedback Tracking (`app/api/reports/[id]/route.js`)
- When an officer selects a report category, `PATCH /api/reports/[id]` updates `ai_assessments`:
  - `officer_action`: Set to `'accepted'` if the chosen category matches the AI suggestion; set to `'overridden'` if the officer selects a different category.
  - Records `actioned_at` and `actioned_by`.
  - Appends `TRIAGED` entry to `audit_log`.

### F. Automated Verification Tests (`tests/ai_engine.test.mjs`)
- Automated unit tests validating:
  1. Coordinate rounding to ~110 meters.
  2. Contact and email scrubbing from notes.
  3. Luganda emergency, enforcement, and referral keyword recognition.
  4. Tier 4 SLA baseline fallback.
  5. Fallback chain safety.
  6. Empty and null input handling.

---

## 3. Operational Runbook

### A. Environment Configuration (`.env.local`)
Configure the following environment variables:

```bash
# PostgreSQL Connection (Use Neon pooled connection with sslmode=require)
DATABASE_URL="postgres://user:password@ep-sample-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Staff Session Token Signing (at least 32 characters)
SESSION_SECRET="your-at-least-32-character-session-secret"

# Authenticator Secret Encryption Key (64 hexadecimal characters)
MFA_ENCRYPTION_KEY="your-64-character-hexadecimal-key"

# Protected Background Worker Secret (Bearer token for /api/cron/ai-worker)
CRON_SECRET="your-random-cron-secret-token"

# Optional: Cloud Multimodal Inference Key (Tier 1 AI)
GEMINI_API_KEY="your-gemini-api-key"
```

### B. Database Migration
Execute migrations in date order using Neon SQL Editor or psql:
```bash
psql "$DATABASE_URL" -f db/migrations/20260930_base_tables.sql
psql "$DATABASE_URL" -f db/migrations/20261001_shared_reporter_storage.sql
psql "$DATABASE_URL" -f db/migrations/20261020_reporter_trust.sql
psql "$DATABASE_URL" -f db/migrations/20261115_ai_jobs_queue.sql
```

### C. Test and Build Execution
```bash
# Run unit test suite (47 tests, 100 percent pass required)
npm test

# Verify production build compilation (0 errors required)
npm run build
```

---

## 4. GitHub Settings Required from Repository Owner (Eleanor Nabaloga)

As a contributor, the following repository-level configurations require administrative execution by repository owner `@EleanorNabaloga`:

### A. Repository Description and Topics
Run via GitHub CLI:
```bash
gh repo edit EleanorNabaloga/wetland-nema \
  --description "Official staff dashboard for NEMA environmental incident sorting, statutory SLA tracking, and wetland hotspot monitoring in Uganda." \
  --add-topic "environmental-monitoring,uganda,nema,wetlands,ai-sorting,hotspot-detection,nextjs,postgres,audit-logging,sla-tracking"
```

### B. Branch Protection Rules (`Settings > Branches`)
Configure rules for `main`, `staging`, and `dev`:
1. Require a pull request before merging.
2. Require approvals (minimum 1) and enable *Require review from Code Owners*.
3. Dismiss stale pull request approvals when new commits are pushed.
4. Require status checks to pass before merging:
   - `validate` (Lint, Test and Build)
   - `sast` (CodeQL Security Scan)
   - `verify-authorization` (Merge Guard)
   - `verify-environment-authorization` (Environment Authorization Gate)
   - `lint-pr-title` (Pull Request Title Linter)
5. Restrict who can push to matching branches: `@EleanorNabaloga` and `@MarkDanielsMCraft`.
6. Enforce restrictions for administrators: *Do not allow bypassing the above settings*.

### C. Environment Protection Rules (`Settings > Environments`)
Create environments: `production` (branch: `main`), `staging` (branch: `staging`), and `development` (branch: `dev`).
Add required reviewers: `@EleanorNabaloga` and `@MarkDanielsMCraft`.
