# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-11

### Added
- Four-tier AI sorting fallback engine in `lib/ai/fallbackEngine.js`:
  - Tier 1: Cloud Multimodal REST API evaluation with bounded timeout.
  - Tier 2: Decoupled local CPU small model for offline operation.
  - Tier 3: Rule-based word matching for Ugandan environmental terms in Luganda, Runyankole, Acholi, Kiswahili, and English.
  - Tier 4: Reliable baseline fallback to statutory SLA type weights.
- Background AI queue worker endpoint at `app/api/cron/ai-worker/route.js` using short database leases (under 15 milliseconds) and out-of-band evaluation.
- Production database migration in `db/migrations/20261115_ai_jobs_queue.sql` defining `ai_triage_queue` and `ai_assessments` with partial indices.
- Officer sorting action feedback tracking in `app/api/reports/[id]/route.js`, recording whether officers accepted or overrode AI suggestions.
- Reviewer dashboard UI additions in `app/dashboard/page.js`:
  - Queue suggestion badge (`Suggested: [Category]`).
  - Report inspection Helpful Suggestion Card with one-click acceptance.
- Dynamic AI table helpers in `lib/schema.js` (`ensureAiTables()` and `aiJoinSql()`) supporting both PostgreSQL and JSON demo fallback mode.
- Centralized observability and error tracking module in `lib/observability.js` separating expected business guards from system crashes, with zero-PII sanitization.
- Automated unit test suite in `tests/ai_engine.test.mjs` verifying coordinate rounding (~110 meters), contact detail scrubbing, Luganda keywords, tier transitions, and empty input handling.
- Automated documentation integrity test suite in `tests/docs_integrity.test.mjs` (`npm run test:docs`) validating markdown links, environment variable parity against `.env.example`, npm scripts synchronization, issue/PR template schemas, and API documentation route parity.
- Open-source governance and security files:
  - `LICENSE` (GNU Affero General Public License v3).
  - `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
  - `CONTRIBUTING.md` (branch promotion workflow and maintainer gates).
  - `SECURITY.md` (vulnerability disclosure policy and zero-PII whistleblower protection).
- Automated CI and repository protection workflows:
  - `.github/workflows/ci.yml` (automated test, build, and CodeQL SAST scanning).
  - `.github/workflows/merge-guard.yml` (branch promotion hierarchy, fork isolation, and maintainer review gates).
  - `.github/workflows/release.yml` (automated semantic versioning and release notes).
  - `.github/workflows/pr-lint.yml` (Conventional Commits PR title validation).
  - `.github/workflows/stale.yml` (automated inactive issue and PR cleanup).
  - `.github/dependabot.yml` (automated daily dependency security updates).
  - `.github/CODEOWNERS` (restricting code review to @EleanorNabaloga and @MarkDanielsMCraft).
  - `.githooks/pre-push` and `scripts/install-git-hooks.mjs` (client-side pre-push hooks blocking direct pushes to protected branches).
  - `.github/ISSUE_TEMPLATE/` (bug reports, feature proposals, documentation updates, AI feedback, and config chooser).
- Comprehensive technical roadmap in `docs/ROADMAP.md` tracking planned milestones strictly from existing design specifications.
- Engineering handoff documentation in `docs/HANDOFF.md`.

### Changed
- Updated `README.md` with CI badges, Mermaid architecture diagrams, quickstart guides, and automated test count declarations.
- Updated `docs/architecture.md` with Mermaid sequence diagrams detailing TOTP MFA lifecycle, statutory SLA deadlines, and AI micro-transaction isolation.
- Updated `docs/api.md` documenting `/api/cron/ai-worker` authentication, concurrency, and response contracts.
- Updated `docs/ai.md` documenting the implemented 4-tier fallback engine and database schemas.
- Configured `"license": "AGPL-3.0"` and `"prepare": "node scripts/install-git-hooks.mjs"` in `package.json`.

### Fixed
- Fixed PostgreSQL partial index conflict predicate in `app/api/cron/ai-worker/route.js`: updated to `ON CONFLICT (report_id) WHERE is_latest = true DO UPDATE SET` (preventing PostgreSQL error 42P10).
- Fixed defensive null handling across fallback tiers in `lib/ai/fallbackEngine.js` to ensure reliable fallback when input fields are empty.
- Fixed Node.js 24 test runner discovery by updating test script glob in `package.json` to `'tests/*.test.mjs'`.

### Security
- Enforced strict zero-PII sanitization across all log outputs.
- Rounded coordinates to 3 decimal places (~110 meters) prior to logging or external model checks.
- Scrubbed telephone numbers and email addresses from citizen incident notes before external dispatch.
- Secured staff dashboard with TOTP MFA (AES-256-GCM encrypted secrets) and HS256 session cookies with SameSite strict flags.

## [0.1.0] - 2026-10-31

### Added
- Initial staff review dashboard for environmental officers.
- Email and password authentication with two-step authenticator setup.
- Statutory SLA deadline tracking for acknowledgement, triage, inspection, and decisions.
- Hotspot spatial grid clustering (500 meter squares) with age decay and anti-Sybil damping.
- Role-based access control for reviewer, inspector, legal, oversight, and admin staff.
