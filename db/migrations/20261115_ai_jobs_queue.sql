-- AI processing queue and assessments tables (lib/ai/).
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS ai_triage_queue (
  id            bigserial PRIMARY KEY,
  report_id     text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' 
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  tier_executed smallint CHECK (tier_executed BETWEEN 1 AND 4),
  attempts      int NOT NULL DEFAULT 0,
  max_attempts  int NOT NULL DEFAULT 3,
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_triage_queue_poll 
  ON ai_triage_queue (created_at ASC) 
  WHERE status IN ('pending', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_triage_queue_report 
  ON ai_triage_queue (report_id);

CREATE TABLE IF NOT EXISTS ai_assessments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  model_id           text NOT NULL,
  prompt_version     text NOT NULL,
  severity           text CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  suggested_category text CHECK (suggested_category IN ('Emergency', 'Enforcement', 'Referral', 'Duplicate', 'Insufficient')),
  suggested_outcome  text CHECK (suggested_outcome IN ('Inspector will visit', 'Referred to another agency', 'Need more information')),
  confidence         real NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
  urgency_score      real NOT NULL CHECK (urgency_score BETWEEN 0.0 AND 1.0),
  key_evidence_tags  text[] DEFAULT '{}',
  reason             text NOT NULL,
  officer_action     text DEFAULT 'pending' CHECK (officer_action IN ('pending', 'accepted', 'overridden', 'dismissed')),
  actioned_at        timestamptz,
  actioned_by        text,
  tier_executed      smallint NOT NULL,
  latency_ms         int,
  is_latest          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_assessments_latest 
  ON ai_assessments (report_id) 
  WHERE is_latest = true;

CREATE INDEX IF NOT EXISTS idx_ai_assessments_triage 
  ON ai_assessments (severity, confidence) 
  WHERE is_latest = true;

CREATE TABLE IF NOT EXISTS system_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);
