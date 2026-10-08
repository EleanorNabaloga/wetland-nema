// How serious each kind of report is. Edit these numbers to tune the ranking.
const WEIGHT_BY_TYPE = {
  "Sewer spill": 8,
  "Wildlife distress": 4,
  "Vegetation loss": 4,
  "Plastic waste": 2,
  Other: 1,
};
const DEFAULT_WEIGHT = 2;

const CELL_M = 500; // grid cell size in metres
const HALF_LIFE_DAYS = 14; // a report counts half as much every 14 days
const REPEAT_FACTOR = 0.1; // extra reports from the same reporter in a cell count 10%
const MIN_SCORE = 4; // cells below this are not shown
const MAX_ACC_M = 250; // GPS fixes worse than this are left out
const DAY = 86400000;

export function weightOf(r) {
  if (WEIGHT_BY_TYPE[r.type] != null) return WEIGHT_BY_TYPE[r.type];
  const t = ((r.type || "") + " " + (r.category || "")).toLowerCase();
  if (/oil|chemical|sewer|sewage|toxic|fuel|dye/.test(t)) return 8;
  if (/wildlife|animal|fish|vegetation|tree|papyrus|reed|fill|drain|encroach|burn/.test(t)) return 4;
  if (/rubbish|waste|plastic|litter|garbage|dump/.test(t)) return 2;
  return DEFAULT_WEIGHT;
}

// Whatever field identifies the reporter, if the reports carry one.
export const reporterOf = (r) =>
  r.reporterId ?? r.reporter ?? r.publicKey ?? r.token ?? null;

const timeOf = (r) => Number(r.ts) || Number(r.receivedAt) || Date.now();

function levelOf(score, singleSource) {
  if (singleSource) return "yellow"; // one reporter alone can never make red or orange
  if (score >= 16) return "red";
  if (score >= 8) return "orange";
  return "yellow";
}

// Only reviewed reports with a usable GPS fix count.
export function computeHotspots(reports, now = Date.now()) {
  const usable = (reports || []).filter(
    (r) =>
      r.status === "viewed" &&
      Number.isFinite(r.lat) &&
      Number.isFinite(r.lng) &&
      (r.acc == null || r.acc <= MAX_ACC_M),
  );
  if (!usable.length) return [];

  const reporterKnown = usable.some((r) => reporterOf(r) != null);
  const lat0 = usable.reduce((s, r) => s + r.lat, 0) / usable.length;
  const mLat = 110574;
  const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);

  const cells = new Map();
  for (const r of usable) {
    const iy = Math.floor((r.lat * mLat) / CELL_M);
    const ix = Math.floor((r.lng * mLng) / CELL_M);
    const key = ix + ":" + iy;
    if (!cells.has(key)) cells.set(key, { ix, iy, reports: [] });
    cells.get(key).reports.push(r);
  }

  const out = [];
  for (const cell of cells.values()) {
    const byReporter = new Map();
    for (const r of cell.reports) {
      const ageDays = Math.max(0, (now - timeOf(r)) / DAY);
      const value = weightOf(r) * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
      const who = reporterKnown ? (reporterOf(r) ?? "unknown:" + r.id) : "report:" + r.id;
      if (!byReporter.has(who)) byReporter.set(who, []);
      byReporter.get(who).push(value);
    }

    let score = 0;
    for (const values of byReporter.values()) {
      values.sort((a, b) => b - a);
      values.forEach((v, i) => {
        score += i === 0 ? v : v * REPEAT_FACTOR;
      });
    }
    if (score < MIN_SCORE) continue;

    let recent = 0;
    let previous = 0;
    for (const r of cell.reports) {
      const ageDays = (now - timeOf(r)) / DAY;
      if (ageDays < HALF_LIFE_DAYS) recent += weightOf(r);
      else if (ageDays < HALF_LIFE_DAYS * 2) previous += weightOf(r);
    }
    const trend =
      recent > previous * 1.25 ? "worsening" : recent < previous * 0.75 ? "improving" : "steady";

    const singleSource = reporterKnown && byReporter.size < 2;
    const types = {};
    for (const r of cell.reports) types[r.type || "Other"] = (types[r.type || "Other"] || 0) + 1;
    const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0][0];

    out.push({
      level: levelOf(score, singleSource),
      singleSource,
      score: Math.round(score * 10) / 10,
      reportCount: cell.reports.length,
      reporterCount: reporterKnown ? byReporter.size : null,
      trend,
      topType,
      lastReportAt: Math.max(...cell.reports.map(timeOf)),
      lat: Math.round(((((cell.iy + 0.5) * CELL_M) / mLat)) * 1e5) / 1e5,
      lng: Math.round(((((cell.ix + 0.5) * CELL_M) / mLng)) * 1e5) / 1e5,
      ids: cell.reports.map((r) => r.id),
    });
  }
  return out.sort((a, b) => b.score - a.score).map((h, i) => ({ rank: i + 1, ...h }));
}
