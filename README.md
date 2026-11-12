# Kuuma Obutonde: Environmental Protection Staff Dashboard

[![CI Validation](https://github.com/EleanorNabaloga/wetland-nema/actions/workflows/ci.yml/badge.svg)](https://github.com/EleanorNabaloga/wetland-nema/actions/workflows/ci.yml)
[![Merge Guard](https://github.com/EleanorNabaloga/wetland-nema/actions/workflows/merge-guard.yml/badge.svg)](https://github.com/EleanorNabaloga/wetland-nema/actions/workflows/merge-guard.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/security-policy-informational.svg)](SECURITY.md)

Kuuma Obutonde is an open-source environmental incident response and wetland monitoring system operating in Uganda. The platform helps environmental officers review and sort citizen incident reports, track statutory deadlines, spot critical wetland harm hotspots, and coordinate field checks.

The system is organized into two cooperating applications that connect to a shared PostgreSQL database:

| Component | Repository | Target Users | Operational Purpose |
| :--- | :--- | :--- | :--- |
| **Citizen Reporter** | [Wetland-watch](https://github.com/EleanorNabaloga/Wetland-watch) | General Public | Captures incident photos, attaches device evidence signatures, submits reports, and checks reward status. |
| **Staff Dashboard** | **wetland-nema** (this repository) | NEMA Officers & Legal Staff | Staff authentication with MFA, 4-tier AI sorting, deadline tracking, hotspot mapping, and audit logging. |

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph PublicSpace["Public Space: Citizen Reporter"]
        ReporterApp["Wetland-watch Web App"]
        HardwareKey["IndexedDB ECDSA P-256 Key"]
        ReporterApp -->|Signs Evidence Payload| HardwareKey
    end

    subgraph DataPlane["Data Plane: Neon Postgres"]
        ReportsTable["reports"]
        QueueTable["ai_triage_queue"]
        AssessmentsTable["ai_assessments"]
        VaultTable["identity_vault"]
        AuditTable["audit_log"]
        ReportsTable -->|Triggers Background Job| QueueTable
    end

    subgraph InternalSpace["Internal Space: Staff Dashboard"]
        WorkerCron["Cron AI Worker: /api/cron/ai-worker"]
        FallbackEngine["4-Tier AI Fallback Engine"]
        StaffUI["Next.js Staff Dashboard"]
        OfficerReview["Officer Review & Inspection Decision"]

        QueueTable -->|Leases Micro-Batch| WorkerCron
        WorkerCron -->|Fallback Check Loop| FallbackEngine
        FallbackEngine -->|Writes Suggestions| AssessmentsTable
        AssessmentsTable -->|Surfaces Suggestions| StaffUI
        StaffUI -->|Records Officer Action| OfficerReview
        OfficerReview -->|Appends Immutable Entry| AuditTable
    end

    ReporterApp -->|Submits Report| ReportsTable
```

The applications share database state without coupling runtime processes. The reporter application owns initial report creation and citizen reward identity, while the staff dashboard manages review stages, SLA clocks, officer assignments, and audit trails.

---

## 2. Core Capabilities

### Four-Tier AI Sorting Pipeline
To work reliably even with slow internet or offline servers, the dashboard includes a four-tier fallback engine:
1. **Tier 1 (Cloud Multimodal API)**: High-resolution visual review and multilingual understanding via structured JSON outputs.
2. **Tier 2 (Local CPU Model)**: Small local model for on-site setups without external internet access.
3. **Tier 3 (Local Language Keyword Rules)**: Fast rules matching Ugandan environmental terms in Luganda, Runyankole, Acholi, Kiswahili, and English (such as *kazambi*, *obukyafu*, *obutwa*, *okutema*, *lutobazi*).
4. **Tier 4 (Base Deadline Weights)**: Statutory deadline defaults and standard report type weights.

The AI system gives helpful suggestions only. Category decisions, field inspection visits, and legal actions remain server-controlled and require officer confirmation.

### Multi-Factor Authentication and RBAC
- **Strict Staff Roles**: `reviewer`, `inspector`, `legal`, `oversight`, and `admin`.
- **MFA Enforcement**: TOTP 6-digit codes with AES-256-GCM encrypted server-side secrets and replay prevention.
- **Session Security**: Signed HS256 tokens with HTTP-only, SameSite strict cookies.

### Statutory SLA Tracking
Tracks operational deadlines from initial submission:
- **Acknowledgement**: Due within 2 days.
- **Sort (Category Choice)**: Due within 7 days.
- **Field Inspection**: Due within 3 days for Emergency, 30 days for Enforcement.
- **Final Regulatory Decision**: Due within 45 days.

### Hotspot Detection and Geospatial Clustering
Groups reviewed incidents into 500-meter grid squares weighted by severity, age decay, and reporter credibility. Oversight officers review aggregate regional impact without accessing personal informant details.

---

## 3. Quickstart Guide

### Prerequisites
- Node.js 20.0.0 or newer
- npm 10.0.0 or newer

### Local Demo Mode
Run the dashboard locally without configuring an external database. The application uses local JSON fallback storage:

```bash
# 1. Install dependencies (configures local git safeguards automatically)
npm ci

# 2. Start development server on port 3001
npm run dev

# 3. Access dashboard in browser
# URL: http://localhost:3001
# Default Admin: admin@nema.gov
# Default Password: NemaAdmin!123
```

### Production Setup with Neon PostgreSQL
Create a `.env.local` configuration in the project root:

```bash
DATABASE_URL="postgres://user:password@ep-sample-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
SESSION_SECRET="your-at-least-32-character-random-session-secret"
MFA_ENCRYPTION_KEY="your-64-character-hex-encryption-key"
CRON_SECRET="your-random-cron-bearer-token"
GEMINI_API_KEY="your-gemini-api-key"
```

Execute database migrations:
```bash
psql "$DATABASE_URL" -f db/migrations/20260930_base_tables.sql
psql "$DATABASE_URL" -f db/migrations/20261001_shared_reporter_storage.sql
psql "$DATABASE_URL" -f db/migrations/20261020_reporter_trust.sql
psql "$DATABASE_URL" -f db/migrations/20261115_ai_jobs_queue.sql
```

Compile and start production server:
```bash
npm run build
npm start
```

---

## 4. Roles and Access Permissions

| Role | Review and Sort | Trigger Field Inspections | View Audit Trail | Manage Staff Accounts | Access Aggregate Hotspots |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `reviewer` | Yes | Yes | Yes | No | Yes |
| `inspector` | Yes | Yes | Yes | No | Yes |
| `legal` | Read Only | Read Only | Yes | No | Yes |
| `oversight` | No | No | No | No | Yes (Totals Only) |
| `admin` | No | No | Yes | Yes | No |

---

## 5. Verification and Test Suite

Execute the test suite using Node.js native test runner:

```bash
# Execute entire test suite (unit, integration, and documentation integrity)
npm test

# Run documentation integrity and link verification specifically
npm run test:docs
```

47 automated tests validate:
- **Documentation Integrity & Synchronization**: Verifies markdown link resolution, environment variable parity against `.env.example`, npm script references, and issue/PR template schemas.
- **AI Sorting Fallback Engine**: Tests coordinate rounding (~110 meters), contact scrubbing, Luganda keywords, and tier transitions.
- **SLA State Machine**: Validates transitions, overdue deadlines, and statutory time spans.
- **Geospatial Hotspots**: Validates grid clustering, duplicate reporter checks, and decay formulas.
- **TOTP MFA Security**: Validates time step windows, clock drift tolerance, and replay rejections.

---

## 6. Open Source Governance and Fork Policy

### Why We Welcome Forks and Community Cloning
Kuuma Obutonde is distributed under the **GNU Affero General Public License v3 (AGPL-3.0)**. We encourage researchers, municipal authorities, universities, and environmental organizations to fork, clone, inspect, and deploy this software.

To protect community innovation and prevent proprietary lock-in:
1. **Copyleft Invariant**: Any entity that modifies this software and provides it over a network must release all source code modifications under the AGPL-3.0.
2. **Trademark Separation**: The names Kuuma Obutonde, National Environment Management Authority, NEMA, and official state seals are protected trademarks. Forked distributions cannot represent themselves as the official statutory authority of Uganda.
3. **Data and Cryptographic Sovereignty**: Forking the code does not grant access to official Ugandan environmental registries, whistleblower identity vaults, or production cryptographic credentials.
4. **Merge Protection**: Pull requests from external forks are gated by automated merge guards and code owner policies. Only authorized internal maintainers (@EleanorNabaloga and @MarkDanielsMCraft) can merge to integration branches.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflows and [SECURITY.md](SECURITY.md) for vulnerability disclosure procedures.
