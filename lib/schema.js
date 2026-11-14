import { query } from "./db.js";

// The reporter app adds reports.signature / signature_status when it stores its
// first signed report. The dashboard reads signature_status, so it makes sure
// the columns exist too (same statement, safe to run any number of times).
// If the database refuses, the dashboard still works and shows no status.
let ready;
export function ensureSignatureColumns() {
  if (!ready) {
    ready = Promise.resolve(
      query(
        `ALTER TABLE reports
           ADD COLUMN IF NOT EXISTS signature text,
           ADD COLUMN IF NOT EXISTS signature_status text`,
      ),
    )
      .then(() => true)
      .catch((error) => {
        console.error("Could not add evidence-signature columns:", error.message);
        ready = undefined;
        return false;
      });
  }
  return ready;
}

/** SQL for the signature status column, or NULL when it is unavailable. */
export async function signatureStatusSql() {
  return (await ensureSignatureColumns())
    ? `r.signature_status AS "signatureStatus"`
    : `NULL AS "signatureStatus"`;
}

let aiReady;
export function ensureAiTables() {
  if (!aiReady) {
    aiReady = Promise.resolve(
      query(`
        CREATE TABLE IF NOT EXISTS ai_triage_queue (
          id bigserial PRIMARY KEY,
          report_id text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          tier_executed smallint CHECK (tier_executed BETWEEN 1 AND 4),
          attempts int NOT NULL DEFAULT 0,
          max_attempts int NOT NULL DEFAULT 3,
          locked_at timestamptz,
          locked_by text,
          last_error text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_triage_queue_report ON ai_triage_queue (report_id);
        CREATE INDEX IF NOT EXISTS idx_ai_triage_queue_poll ON ai_triage_queue (created_at ASC) WHERE status IN ('pending', 'processing');
        CREATE TABLE IF NOT EXISTS ai_assessments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          model_id text NOT NULL,
          prompt_version text NOT NULL,
          severity text CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
          suggested_category text CHECK (suggested_category IN ('Emergency', 'Enforcement', 'Referral', 'Duplicate', 'Insufficient')),
          suggested_outcome text CHECK (suggested_outcome IN ('Inspector will visit', 'Referred to another agency', 'Need more information')),
          confidence real NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
          urgency_score real NOT NULL CHECK (urgency_score BETWEEN 0.0 AND 1.0),
          key_evidence_tags text[] DEFAULT '{}',
          reason text NOT NULL,
          officer_action text DEFAULT 'pending' CHECK (officer_action IN ('pending', 'accepted', 'overridden', 'dismissed')),
          actioned_at timestamptz,
          actioned_by text,
          tier_executed smallint NOT NULL,
          latency_ms int,
          is_latest boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_assessments_latest ON ai_assessments (report_id) WHERE is_latest = true;
        CREATE INDEX IF NOT EXISTS idx_ai_assessments_triage ON ai_assessments (severity, confidence) WHERE is_latest = true;
        CREATE TABLE IF NOT EXISTS system_settings (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          description text,
          updated_at timestamptz NOT NULL DEFAULT now(),
          updated_by text
        );
        CREATE TABLE IF NOT EXISTS field_inspections (
          id text PRIMARY KEY,
          report_id text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          ranger_email text NOT NULL,
          certificate_number text NOT NULL,
          lat double precision NOT NULL,
          lng double precision NOT NULL,
          distance_m double precision NOT NULL,
          photo_url text,
          water_ph numeric(3, 1),
          water_clarity text CHECK (water_clarity IN ('clear', 'murky_clay', 'chemical_opaque', 'oil_sheen')),
          odor text CHECK (odor IN ('natural_earth', 'raw_sewage', 'chemical_solvent', 'burning', 'none')),
          findings_summary text,
          action_recommended text CHECK (action_recommended IN ('restoration_order', 'stop_notice', 'environmental_police_escort', 'no_violation_natural_runoff', 'refer_to_local_council')),
          forced boolean NOT NULL DEFAULT false,
          force_reason text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE field_inspections ADD COLUMN IF NOT EXISTS forced boolean NOT NULL DEFAULT false;
        ALTER TABLE field_inspections ADD COLUMN IF NOT EXISTS force_reason text;
        CREATE INDEX IF NOT EXISTS idx_field_inspections_report ON field_inspections (report_id);
      `),
    )
      .then(() => true)
      .catch((error) => {
        aiReady = undefined;
        return false;
      });
  }
  return aiReady;
}

export async function aiJoinSql() {
  const ok = await ensureAiTables();
  if (ok) {
    return {
      select: `, a.severity AS "aiSeverity", a.suggested_category AS "aiCategory", a.confidence AS "aiConfidence", a.urgency_score AS "aiUrgency", a.reason AS "aiReason", COALESCE(fi.forced, false) AS "inspectionForced", fi.force_reason AS "inspectionForceReason"`,
      join: `LEFT JOIN ai_assessments a ON a.report_id = r.id AND a.is_latest = true
             LEFT JOIN LATERAL (SELECT forced, force_reason FROM field_inspections fi WHERE fi.report_id = r.id ORDER BY fi.created_at DESC LIMIT 1) fi ON true`,
    };
  }
  return {
    select: `, NULL AS "aiSeverity", NULL AS "aiCategory", NULL AS "aiConfidence", NULL AS "aiUrgency", NULL AS "aiReason", false AS "inspectionForced", NULL AS "inspectionForceReason"`,
    join: ``,
  };
}
