-- Reporter trust scores (lib/trust.js). The dashboard also creates these
-- tables on first use; this file is the record of the change. Safe to run
-- more than once.

CREATE TABLE IF NOT EXISTS reporter_trust (
  reporter_key   text PRIMARY KEY,                  -- the phone's public key
  score          real NOT NULL DEFAULT 40,
  verified_count integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One trust event per report: report_verified, duplicate_upload or report_false.
CREATE TABLE IF NOT EXISTS trust_events (
  report_id    text PRIMARY KEY,
  reporter_key text NOT NULL,
  event        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
