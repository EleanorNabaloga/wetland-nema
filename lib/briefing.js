import { slaInfo, currentStage, fmtSpan, STAGE_LABEL } from "./sla.js";
import { detectFraudPatterns } from "./fraud.js";

export const SEVERITY_ORDER = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export function getSeverity(r) {
  return r.aiSeverity || r.severity || "Low";
}

export function compareSeverity(a, b) {
  const sa = SEVERITY_ORDER[getSeverity(a)] || 0;
  const sb = SEVERITY_ORDER[getSeverity(b)] || 0;
  return sb - sa;
}

const TWO_DAYS_MS = 48 * 3600000;

export function generateBriefing(
  reports = [],
  { hotspots = [], pendingStaff = [], claims = [], now = Date.now(), customSettings = null } = {},
) {
  const list = Array.isArray(reports) ? reports : [];

  // 1. New Critical and High reports
  const newUrgent = list
    .filter(
      (r) =>
        r.status === "new" &&
        ["Critical", "High"].includes(getSeverity(r)),
    )
    .sort((a, b) => {
      const sevDiff = compareSeverity(a, b);
      if (sevDiff !== 0) return sevDiff;
      const timeA = Number(a.receivedAt || a.ts) || 0;
      const timeB = Number(b.receivedAt || b.ts) || 0;
      return timeB - timeA;
    });

  // 2. Deadline nudges: due within 48h or overdue, sorted by severity descending then time left ascending
  const deadlineNudges = list
    .map((r) => {
      const info = slaInfo(r, now, customSettings);
      return { report: r, sla: info };
    })
    .filter(
      ({ sla }) =>
        sla.stage !== "done" &&
        (sla.overdue || (Number.isFinite(sla.left) && sla.left <= TWO_DAYS_MS)),
    )
    .sort((a, b) => {
      const sevDiff = compareSeverity(a.report, b.report);
      if (sevDiff !== 0) return sevDiff;
      return (a.sla.left || 0) - (b.sla.left || 0);
    });

  // Group nudges by stage
  const nudgesByStage = {
    acknowledge: [],
    triage: [],
    inspect: [],
    decide: [],
  };

  for (const n of deadlineNudges) {
    if (nudgesByStage[n.sla.stage]) {
      nudgesByStage[n.sla.stage].push(n);
    }
  }

  // 3. Hotspots that got worse or have active critical threats
  const worsenedHotspots = (Array.isArray(hotspots) ? hotspots : []).filter(
    (h) =>
      h.trend === "worsening" ||
      h.trend === "worse" ||
      (h.criticalCount && h.criticalCount > 0),
  );

  // 4. Pending staff requests (for admins)
  const pendingStaffCount = Array.isArray(pendingStaff)
    ? pendingStaff.filter((s) => s.status === "pending").length
    : typeof pendingStaff === "number"
    ? pendingStaff
    : 0;

  // 5. Reward fraud pattern checks
  const claimsWaitingFraudCheck = detectFraudPatterns(claims);

  const overdueCount = deadlineNudges.filter((n) => n.sla.overdue).length;

  return {
    generatedAt: now,
    summary: {
      urgentCount: newUrgent.length,
      nudgeCount: deadlineNudges.length,
      overdueCount,
      worsenedHotspotCount: worsenedHotspots.length,
      pendingStaffCount,
      fraudHoldCount: claimsWaitingFraudCheck.length,
    },
    newUrgent,
    deadlineNudges,
    nudgesByStage,
    worsenedHotspots,
    pendingStaffCount,
    claimsWaitingFraudCheck,
  };
}

export function draftReporterMessage(report, lang = "en") {
  if (!report) return "";
  const isLg = lang === "lg";
  const stage = currentStage(report);
  const category = report.category;

  if (report.status === "new" || stage === "acknowledge") {
    return isLg
      ? "Webale kukuuma ntobazi zaffe. NEMA efunye alipoota yo era egenda kwekeneenyezebwa."
      : "Thank you for protecting our wetlands. NEMA has received your incident report and assigned it for review.";
  }

  if (category === "Emergency" || category === "Enforcement") {
    if (!report.inspectedAt) {
      return isLg
        ? "Amawulire okuva mu NEMA: Omukenkufu w'ebyobutonde ategekeddwa okulambula ekifo ekyaloopeddwa."
        : "Update from NEMA: An environmental inspector has been scheduled to visit the reported site.";
    }
    const action = report.actionNote || report.outcome || "Action taken";
    return isLg
      ? `Amawulire okuva mu NEMA: Okulambula kw'ekifo kuwedde. Ekisaliddwaawo: ${action}.`
      : `Update from NEMA: Site inspection completed. Action: ${action}.`;
  }

  if (category === "Referral") {
    return isLg
      ? "Amawulire okuva mu NEMA: Alipoota yo eweerezeddwa eri abakwatibwako mu gavumenti ez'ebitundu."
      : "Update from NEMA: Your report has been referred to the appropriate local authority for follow-up.";
  }

  if (category === "Insufficient" || report.outcome === "Need more information") {
    return isLg
      ? "Amawulire okuva mu NEMA: Twetaaga ebisingawo oba ebifaananyi okwongera ku alipoota eno."
      : "Update from NEMA: Additional details or photos are needed to proceed with this report.";
  }

  return isLg
    ? "Amawulire okuva mu NEMA: Alipoota yo eri mu kukolwako ttiimu y'ebyobutonde."
    : "Update from NEMA: Your incident report is being processed by our environmental team.";
}
