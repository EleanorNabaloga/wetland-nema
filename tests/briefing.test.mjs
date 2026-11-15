import test from "node:test";
import assert from "node:assert/strict";
import {
  generateBriefing,
  draftReporterMessage,
  compareSeverity,
  getSeverity,
} from "../lib/briefing.js";

const DAY = 86400000;

test("getSeverity extracts aiSeverity or severity or defaults to Low", () => {
  assert.equal(getSeverity({ aiSeverity: "Critical" }), "Critical");
  assert.equal(getSeverity({ severity: "High" }), "High");
  assert.equal(getSeverity({}), "Low");
});

test("compareSeverity ranks Critical > High > Medium > Low", () => {
  assert.ok(compareSeverity({ aiSeverity: "Critical" }, { aiSeverity: "High" }) < 0);
  assert.ok(compareSeverity({ aiSeverity: "High" }, { aiSeverity: "Medium" }) < 0);
  assert.ok(compareSeverity({ aiSeverity: "Medium" }, { aiSeverity: "Low" }) < 0);
  assert.equal(compareSeverity({ aiSeverity: "High" }, { aiSeverity: "High" }), 0);
});

test("generateBriefing extracts new Critical and High reports", () => {
  const now = Date.now();
  const reports = [
    { id: "1", status: "new", aiSeverity: "Critical", receivedAt: now - 1000 },
    { id: "2", status: "new", aiSeverity: "High", receivedAt: now - 2000 },
    { id: "3", status: "new", aiSeverity: "Medium", receivedAt: now - 500 },
    { id: "4", status: "viewed", aiSeverity: "Critical", receivedAt: now - 3000 },
  ];

  const briefing = generateBriefing(reports, { now });
  assert.equal(briefing.summary.urgentCount, 2);
  assert.equal(briefing.newUrgent.length, 2);
  assert.equal(briefing.newUrgent[0].id, "1"); // Critical first
  assert.equal(briefing.newUrgent[1].id, "2"); // High second
});

test("generateBriefing identifies impending 48h SLA deadline nudges and overdues", () => {
  const now = 100 * DAY;
  const reports = [
    // acknowledge limit is 2 days. received at now - 1.5 days -> left 0.5 days (12h) <= 48h
    {
      id: "urg-1",
      status: "new",
      aiSeverity: "High",
      receivedAt: now - 1.5 * DAY,
    },
    // acknowledge limit is 2 days. received at now - 2.5 days -> overdue by 0.5 days
    {
      id: "over-1",
      status: "new",
      aiSeverity: "Critical",
      receivedAt: now - 2.5 * DAY,
    },
    // acknowledge limit is 2 days. received at now - 0.1 days -> left 1.9 days (45.6h) <= 48h
    {
      id: "fresh-1",
      status: "new",
      aiSeverity: "Low",
      receivedAt: now - 0.1 * DAY,
    },
  ];

  const briefing = generateBriefing(reports, { now });
  assert.equal(briefing.deadlineNudges.length, 3);
  assert.equal(briefing.summary.overdueCount, 1);
  // Critical should come first even if another has less time left
  assert.equal(briefing.deadlineNudges[0].report.id, "over-1");
  assert.equal(briefing.deadlineNudges[1].report.id, "urg-1");
  assert.equal(briefing.deadlineNudges[2].report.id, "fresh-1");
  assert.equal(briefing.nudgesByStage.acknowledge.length, 3);
});

test("generateBriefing aggregates worsened hotspots and pending staff count", () => {
  const hotspots = [
    { name: "Kinawataka", trend: "worse", criticalCount: 2 },
    { name: "Lubigi", trend: "steady", criticalCount: 0 },
    { name: "Nalukolongo", trend: "better", criticalCount: 1 },
  ];
  const pendingStaff = [
    { email: "officer1@nema.go.ug", status: "pending" },
    { email: "officer2@nema.go.ug", status: "active" },
  ];

  const briefing = generateBriefing([], { hotspots, pendingStaff });
  assert.equal(briefing.summary.worsenedHotspotCount, 2); // Kinawataka (worse) and Nalukolongo (criticalCount > 0)
  assert.equal(briefing.summary.pendingStaffCount, 1);
});

test("draftReporterMessage drafts accurate updates in English and Luganda", () => {
  // New report
  const repNew = { status: "new" };
  assert.match(draftReporterMessage(repNew, "en"), /received your incident report/);
  assert.match(draftReporterMessage(repNew, "lg"), /efunye alipoota yo/);

  // Inspection scheduled
  const repInspect = { status: "viewed", category: "Emergency" };
  assert.match(draftReporterMessage(repInspect, "en"), /inspector has been scheduled/);
  assert.match(draftReporterMessage(repInspect, "lg"), /Omukenkufu w'ebyobutonde ategekeddwa/);

  // Inspected and decided
  const repDone = {
    status: "viewed",
    category: "Emergency",
    inspectedAt: Date.now(),
    actionNote: "Restoration order issued",
  };
  assert.match(draftReporterMessage(repDone, "en"), /Restoration order issued/);
  assert.match(draftReporterMessage(repDone, "lg"), /Restoration order issued/);

  // Referral
  const repRef = { status: "viewed", category: "Referral" };
  assert.match(draftReporterMessage(repRef, "en"), /referred to the appropriate local authority/);
  assert.match(draftReporterMessage(repRef, "lg"), /Alipoota yo eweerezeddwa/);
});
