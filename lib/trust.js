// Reporter trust score. Keeps one score per reporter device key.
// Uses PostgreSQL when the app does, and a local JSON file in demo mode.
import fs from "fs";
import path from "path";
import { query, getPool } from "@/lib/db";

const START_SCORE = 40;
// Score changes. Good events rise slowly, bad events fall fast.
const POINTS = { report_verified: 3, duplicate_upload: -10, report_false: -20 };

const jsonMode = () =>
  process.env.USE_LOCAL_DEMO_FALLBACK === "true" || !process.env.DATABASE_URL;

export function levelOf(score, verifiedCount) {
  if (score < 20) return "restricted";
  if (verifiedCount < 5) return "new";
  if (score >= 70) return "trusted";
  return "standard";
}

// Which trust event, if any, a triage category triggers.
export function eventForCategory(category) {
  if (["Emergency", "Enforcement", "Referral"].includes(category)) return "report_verified";
  if (category === "Duplicate") return "duplicate_upload";
  return null; // Insufficient: not the reporter's fault, no change
}

function nextScore(score, event) {
  let delta = POINTS[event] || 0;
  if (delta > 0) delta = delta * (1 - score / 120); // slower to rise as it grows
  return Math.round(Math.min(100, Math.max(0, score + delta)) * 10) / 10;
}

async function reporterKeyOf(reportId) {
  const res = await query("SELECT * FROM reports r WHERE r.id = $1", [reportId]);
  const row = res.rows[0];
  return row ? row.device_public_key || row.publicKey || row.public_key || null : null;
}

/* ---------- JSON storage (demo mode) ---------- */
const JSON_FILE = path.join(process.cwd(), "data", "reporter_trust.json");
function readJson() {
  try {
    return JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  } catch {
    return { reporters: {}, applied: {} };
  }
}
function writeJson(state) {
  fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true });
  fs.writeFileSync(JSON_FILE, JSON.stringify(state, null, 2));
}

/* ---------- PostgreSQL storage ---------- */
let ready;
function ensureTables() {
  if (!ready) {
    ready = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS reporter_trust (
           reporter_key text PRIMARY KEY,
           score real NOT NULL DEFAULT 40,
           verified_count integer NOT NULL DEFAULT 0,
           updated_at timestamptz NOT NULL DEFAULT now()
         );
         CREATE TABLE IF NOT EXISTS trust_events (
           report_id text PRIMARY KEY,
           reporter_key text NOT NULL,
           event text NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now()
         );`,
      )
      .catch((e) => {
        ready = undefined;
        throw e;
      });
  }
  return ready;
}

async function load(key, reportId) {
  if (jsonMode()) {
    const s = readJson();
    return {
      reporter: s.reporters[key] || { score: START_SCORE, verifiedCount: 0 },
      applied: s.applied[reportId] || null,
    };
  }
  await ensureTables();
  const pool = getPool();
  const r = await pool.query("SELECT score, verified_count FROM reporter_trust WHERE reporter_key = $1", [key]);
  const a = await pool.query("SELECT event FROM trust_events WHERE report_id = $1", [reportId]);
  return {
    reporter: r.rows[0]
      ? { score: Number(r.rows[0].score), verifiedCount: Number(r.rows[0].verified_count) }
      : { score: START_SCORE, verifiedCount: 0 },
    applied: a.rows[0] ? a.rows[0].event : null,
  };
}

async function save(key, reportId, reporter, event) {
  if (jsonMode()) {
    const s = readJson();
    s.reporters[key] = { ...reporter, updatedAt: new Date().toISOString() };
    s.applied[reportId] = event;
    writeJson(s);
    return;
  }
  const pool = getPool();
  await pool.query(
    `INSERT INTO reporter_trust (reporter_key, score, verified_count, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (reporter_key) DO UPDATE
       SET score = EXCLUDED.score, verified_count = EXCLUDED.verified_count, updated_at = now()`,
    [key, reporter.score, reporter.verifiedCount],
  );
  await pool.query(
    `INSERT INTO trust_events (report_id, reporter_key, event) VALUES ($1, $2, $3)
     ON CONFLICT (report_id) DO UPDATE SET event = EXCLUDED.event`,
    [reportId, key, event],
  );
}

// Each report changes the score once. The one exception: marking a report
// false always counts, even after it was verified.
export async function recordTrustEvent(reportId, event) {
  const key = await reporterKeyOf(reportId);
  if (!key) return null;
  const { reporter, applied } = await load(key, reportId);
  if (applied && !(event === "report_false" && applied !== "report_false")) return null;

  const updated = {
    score: nextScore(reporter.score, event),
    verifiedCount: reporter.verifiedCount + (event === "report_verified" ? 1 : 0),
  };
  await save(key, reportId, updated, event);
  return updated;
}

export async function getTrustForReport(reportId) {
  const key = await reporterKeyOf(reportId);
  if (!key) return null;
  const { reporter, applied } = await load(key, reportId);
  return {
    score: reporter.score,
    verifiedCount: reporter.verifiedCount,
    level: levelOf(reporter.score, reporter.verifiedCount),
    markedFalse: applied === "report_false",
  };
}
