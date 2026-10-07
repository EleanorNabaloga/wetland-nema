# Wetland Watch: design spec (source of truth)

Separate community signal from evidence-grade cases. Do not pretend every voice note is a legal case. Design for NEMA's absorption capacity.

## Track A: Community Signal
- Anonymous, low-friction reports via IVR, USSD callback, WhatsApp, or PWA.
- Used for hotspots, awareness, early warning. Not automatic enforcement.
- No rewards. No chain-of-custody burden.
- Feedback: "Received. This helps us map the problem."

## Track B: Evidence-Grade Case
- Explicit consent. Capture-time cryptographic signing.
- Feature phone: toll-free 0800 IVR records voice; USSD only for menu/callback.
- Smartphone: offline-first PWA captures photo, GPS accuracy, timestamp, device signature. WhatsApp only for notification, not evidence.
- Human reviewer verifies language, location, context. No auto-translation as evidence.
- Case ID: NEMA-234. Identity stored separately in an encrypted vault.

## Backend
- ASR with language-specific confidence and human review.
- Dedupe: geospatial + audio fingerprint + reporter confirmation.
- Triage: Emergency, Enforcement, Referral, Duplicate, Insufficient.
- Bias audits for hotspot clustering and reporter reputation.
- No auto-rejection. Appeals path.

## NEMA action
- Dashboard with SLA timers: acknowledge, triage, inspect, decide.
- ELMIS API or middleware, not manual re-entry.
- Chain-of-custody package: capture hash, signed transcript, inspector affidavit, legal review.
- Audit trail for every access and decision. Independent oversight sees aggregate data.

## Feedback and incentives
- Safety-aware SMS/IVR: Received, Assigned, Action taken, No action (reason).
- Rewards: community recognition, public thank-you, or lottery-based airtime after verification. Not per-case cash.
- Reporter protection: no retaliation, safe channels, legal support.

## Governance
- MoU: NEMA, telecoms, Data Protection Office, CSOs, judiciary.
- DPIA. Retention with legal hold. Access logs. Role-based access.
- Transparency reports: reports, triage times, enforcement rates, false reports, data protection incidents.

## Pilot
- 6-12 months. Lubigi + one rural wetland + one urban site.
- Baseline and control. Pre-registered metrics: time-to-ack, time-to-triage, time-to-inspection, enforcement rate, false report rate, cost per verified case, inspector hours, reporter safety incidents.
- Scale only if thresholds met and NEMA capacity increases. Otherwise fix the bottleneck first.
