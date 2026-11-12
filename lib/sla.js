export const CATEGORIES = ["Emergency", "Enforcement", "Referral", "Duplicate", "Insufficient"];
export const NEEDS_INSPECTION = ["Emergency", "Enforcement"];

const DAY = 86400000;
// Placeholder limits. Calibrate with NEMA before the pilot.
const LIMITS = { acknowledge: 2 * DAY, triage: 7 * DAY, decide: 45 * DAY };
const inspectLimit = (category) => (category === "Emergency" ? 3 * DAY : 30 * DAY);

export const STAGE_LABEL = { acknowledge: "Acknowledge", triage: "Sort", inspect: "Inspect", decide: "Decide" };

export function currentStage(r) {
  if (r.status !== "viewed") return "acknowledge";
  if (!r.category) return "triage";
  if (NEEDS_INSPECTION.includes(r.category) && !r.inspectedAt) return "inspect";
  if (!r.decidedAt) return "decide";
  return "done";
}

export function slaInfo(r, now = Date.now(), customSettings = null) {
  const stage = currentStage(r);
  if (stage === "done") return { stage };

  const s = customSettings?.sla_limits;
  const acknowledgeDays = s?.acknowledge_days ?? 2;
  const triageDays = s?.triage_days ?? 7;
  const inspectEmergencyDays = s?.inspect_emergency_days ?? 3;
  const inspectRoutineDays = s?.inspect_routine_days ?? 30;
  const decideDays = s?.decide_days ?? 45;

  let limit;
  if (stage === "inspect") {
    limit = (r.category === "Emergency" ? inspectEmergencyDays : inspectRoutineDays) * DAY;
  } else if (stage === "acknowledge") {
    limit = acknowledgeDays * DAY;
  } else if (stage === "triage") {
    limit = triageDays * DAY;
  } else if (stage === "decide") {
    limit = decideDays * DAY;
  } else {
    limit = LIMITS[stage] || 7 * DAY;
  }

  const recTime = Number(r.receivedAt) || Number(r.ts) || now;
  const left = recTime + limit - now;
  return { stage, left, overdue: left < 0 };
}

export function fmtSpan(ms) {
  const m = Math.floor(Math.abs(ms) / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
