-- Base tables for Kuuma Obutonde. Run this first on a new, empty database,
-- then the later migrations in date order (see README, Database).
--
-- Written in November 2026 from the live database, which was first set up by
-- hand in the Neon SQL Editor. Columns added by later migrations are left out
-- here so each file keeps its own change. Safe to run more than once: on the
-- existing database it changes nothing.

BEGIN;

-- Report ids look like NEMA-101.
CREATE SEQUENCE IF NOT EXISTS report_seq START WITH 100;

CREATE TABLE IF NOT EXISTS reports (
  id              text PRIMARY KEY DEFAULT ('NEMA-' || nextval('report_seq')),
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  acc             double precision NOT NULL,        -- made optional in 20261001
  ts              double precision NOT NULL,        -- capture time, ms
  received_at     timestamptz NOT NULL DEFAULT now(),
  type            text NOT NULL DEFAULT '',
  note            text NOT NULL DEFAULT '',
  photo_url       text NOT NULL,                    -- JPEG data URL, or https link
  hash            text NOT NULL UNIQUE,             -- SHA-256 of the evidence
  token_hash      text,                             -- SHA-256 of the reporter's secret token
  status          text NOT NULL DEFAULT 'new',      -- new | viewed
  outcome         text,                             -- next step shown to the reporter
  viewed_at       timestamptz,
  reviewed_by     text,
  triage_category text CHECK (triage_category IN ('Emergency', 'Enforcement', 'Referral', 'Duplicate', 'Insufficient')),
  triaged_at      timestamptz,
  triaged_by      text,
  inspected_at    timestamptz,
  inspected_by    text,
  decided_at      timestamptz
);

-- Reporter contact details for rewards, kept apart from the report.
CREATE TABLE IF NOT EXISTS identity_vault (
  report_id       text PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  encrypted_phone text,                             -- AES-256-GCM, PHONE_ENCRYPTION_KEY
  claimed         boolean NOT NULL DEFAULT false,
  claim_ts        timestamptz
);

CREATE TABLE IF NOT EXISTS staff_users (
  email          text PRIMARY KEY,
  name           text NOT NULL,
  password_hash  text NOT NULL,                     -- bcrypt
  role           text NOT NULL DEFAULT 'reviewer'
                 CHECK (role IN ('reviewer', 'inspector', 'legal', 'oversight', 'admin')),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'disabled', 'rejected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  decided_by     text,
  decided_at     timestamptz,
  totp_secret    text,                              -- AES-256-GCM, MFA_ENCRYPTION_KEY
  totp_enabled   boolean NOT NULL DEFAULT false,
  totp_last_step bigint NOT NULL DEFAULT 0          -- stops an authenticator code being reused
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  report_id     text,
  officer_email text NOT NULL,
  action        text NOT NULL,
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The audit log can only grow: rows cannot be changed or deleted.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

CREATE OR REPLACE TRIGGER audit_log_no_change
  BEFORE DELETE OR UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

COMMIT;
