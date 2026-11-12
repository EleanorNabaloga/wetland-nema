# Security Policy

## 1. Supported Versions

Security fixes and dependency patches are applied to the latest code on the default branch:

| Version | Supported |
| :--- | :--- |
| main (latest) | Yes |
| older commits | No |

---

## 2. Reporting a Vulnerability

We take the security and integrity of Kuuma Obutonde seriously, particularly because this platform protects environmental whistleblowers and government enforcement operations.

If you find a security vulnerability:
1. Do not open a public issue on GitHub.
2. Report the vulnerability privately to the project maintainers with reproduction steps and impact analysis.
3. Allow the engineering team reasonable time to verify, patch, and release a fix before public disclosure.

---

## 3. Threat Model and Anti-Abuse Standards

This project is open source. Cloners, deployers, and contributors must respect these core security boundaries:

### 3.1 Whistleblower Protection and Privacy Standards
- Citizen identity details (such as phone numbers for rewards) are stored exclusively in the separate `identity_vault` table with AES-256-GCM encryption.
- Application logs, telemetry, error monitors, and external AI calls must never contain phone numbers, names, or exact coordinates.
- Location sent to external models is rounded to 3 decimal places (roughly 110 meters) so specific homes cannot be identified.

### 3.2 Anti-Sybil and Reward Abuse Defenses
- Public keys are generated client-side and verified via ECDSA signatures on each submission.
- Duplicate detection compares 64-bit difference hashes and byte fingerprints to prevent automated spam and reward farming.
- AI sorting suggestions never unlock financial rewards. Rewards unlock strictly after an on-site physical inspection affidavit is logged by a field officer.

### 3.3 Protection Against Automated Denial of Service
- Cloud AI inference runs through an asynchronous, rate-limited queue.
- If upstream AI quotas are exhausted or external APIs fail, the system falls back to deterministic local keyword and regular expression rules, preventing service disruption.

### 3.4 Operational Credential Security for Cloners and Deployers
- Never commit `.env.local` or environment secrets to git.
- Use least-privilege PostgreSQL roles. In production, connect through the Neon pooled connection string with SSL required (`?sslmode=require`).
- Protect session tokens (`SESSION_SECRET`) and authenticator secrets (`MFA_ENCRYPTION_KEY`) using high-entropy random keys.
