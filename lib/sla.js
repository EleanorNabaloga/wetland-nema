export const CATEGORIES = ["Emergency", "Enforcement", "Referral", "Duplicate", "Insufficient"];
export const NEEDS_INSPECTION = ["Emergency", "Enforcement"];

const DAY = 86400000;
// Placeholder limits. Calibrate with NEMA before the pilot.
const LIMITS = { acknowledge: 2 * DAY, triage: 7 * DAY, decide: 45 * DAY };
const inspectLimit = (category) => (category === "Emergency" ? 3 * DAY : 30 * DAY);

export const STAGE_LABEL = { acknowledge: "Acknowledge", triage: "Triage", inspect: "Inspect", decide: "Decide" };

export function currentStage(r) {
  if (r.status !== "viewed") return "acknowledge";
  if (!r.category) return "triage";
  if (NEEDS_INSPECTION.includes(r.category) && !r.inspectedAt) return "inspect";
  if (!r.decidedAt) return "decide";
  return "done";
}

export function slaInfo(r, now = Date.now()) {
  const stage = currentStage(r);
  if (stage === "done") return { stage };
  const limit = stage === "inspect" ? inspectLimit(r.category) : LIMITS[stage];
  const left = Number(r.receivedAt) + limit - now;
  return { stage, left, overdue: left < 0 };
}

export function fmtSpan(ms) {
  const m = Math.floor(Math.abs(ms) / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
