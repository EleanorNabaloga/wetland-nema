import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStage, slaInfo, fmtSpan } from "../lib/sla.js";

const DAY = 86400000;
const now = Date.UTC(2026, 10, 11);

test("a new report waits for acknowledgement", () => {
  assert.equal(currentStage({ status: "new" }), "acknowledge");
});

test("a reviewed report without a category waits for triage", () => {
  assert.equal(currentStage({ status: "viewed" }), "triage");
});

test("Emergency and Enforcement need an inspection before a decision", () => {
  assert.equal(currentStage({ status: "viewed", category: "Emergency" }), "inspect");
  assert.equal(currentStage({ status: "viewed", category: "Enforcement" }), "inspect");
  assert.equal(currentStage({ status: "viewed", category: "Enforcement", inspectedAt: 1 }), "decide");
});

test("other categories go straight to a decision", () => {
  assert.equal(currentStage({ status: "viewed", category: "Referral" }), "decide");
  assert.equal(currentStage({ status: "viewed", category: "Referral", decidedAt: 1 }), "done");
});

test("acknowledgement is overdue after 2 days", () => {
  assert.equal(slaInfo({ status: "new", receivedAt: now - 1.9 * DAY }, now).overdue, false);
  assert.equal(slaInfo({ status: "new", receivedAt: now - 2.1 * DAY }, now).overdue, true);
});

test("Emergency inspection is due in 3 days, Enforcement in 30", () => {
  const base = { status: "viewed", receivedAt: now - 4 * DAY };
  assert.equal(slaInfo({ ...base, category: "Emergency" }, now).overdue, true);
  assert.equal(slaInfo({ ...base, category: "Enforcement" }, now).overdue, false);
});

test("a finished report has no deadline", () => {
  assert.deepEqual(slaInfo({ status: "viewed", category: "Duplicate", decidedAt: 1, receivedAt: 0 }, now), {
    stage: "done",
  });
});

test("time spans read as minutes, hours or days", () => {
  assert.equal(fmtSpan(5 * 60000), "5 min");
  assert.equal(fmtSpan(-3 * 3600000), "3 h");
  assert.equal(fmtSpan(3 * DAY), "3 d");
});
