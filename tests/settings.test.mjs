import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, getSystemSettings, applyAiDisplayMode } from "../lib/settings.js";
import { slaInfo } from "../lib/sla.js";
import { weightOf } from "../lib/hotspots.js";
import { executeTier4 } from "../lib/ai/fallbackEngine.js";

test("getSystemSettings returns valid default configuration object", async () => {
  const settings = await getSystemSettings();
  assert.ok(settings.sla_limits);
  assert.equal(settings.sla_limits.acknowledge_days, 2);
  assert.equal(settings.sla_limits.triage_days, 7);
  assert.equal(settings.sla_limits.decide_days, 45);
  assert.ok(settings.hotspot_weights);
  assert.equal(settings.hotspot_weights["Sewer spill"], 8);
  assert.ok(settings.language_keywords);
  assert.ok(settings.language_keywords.emergency_luganda.includes("obutwa"));
  assert.ok(settings.language_keywords.negation_luganda.includes("ssi"));
});

test("slaInfo dynamically respects custom SLA limits", () => {
  const now = 1000000000000;
  // Report received 4 days ago
  const fourDaysMs = 4 * 86400000;
  const report = {
    status: "new",
    receivedAt: now - fourDaysMs,
  };

  // Standard limit is 2 days -> 4 days old is overdue
  const standard = slaInfo(report, now);
  assert.equal(standard.stage, "acknowledge");
  assert.equal(standard.overdue, true);

  // Dynamic limit extended to 5 days -> 4 days old is NOT overdue
  const customSettings = {
    sla_limits: {
      acknowledge_days: 5,
    },
  };
  const dynamic = slaInfo(report, now, customSettings);
  assert.equal(dynamic.stage, "acknowledge");
  assert.equal(dynamic.overdue, false);
});

test("weightOf dynamically respects custom hotspot weights", () => {
  const report = { type: "Custom Hazard", note: "" };
  // Default is 2
  const defaultW = weightOf(report);
  assert.equal(defaultW, 2);

  // Custom weights mapping gives Custom Hazard a weight of 10
  const customWeights = { "Custom Hazard": 10 };
  const customW = weightOf(report, customWeights);
  assert.equal(customW, 10);
});

test("executeTier4 dynamically calculates category from custom weights", () => {
  const report = { type: "Custom Severe Encroachment", note: "" };
  const customWeights = { "Custom Severe Encroachment": 8 };
  const assessment = executeTier4(report, customWeights);
  assert.equal(assessment.category, "Emergency");
  assert.equal(assessment.tier, 4);
});

test("applyAiDisplayMode hides AI suggestions when display_mode is silent", () => {
  const sampleReport = {
    id: "NEMA-1",
    aiCategory: "Emergency",
    aiSeverity: "Critical",
    aiConfidence: 0.9,
    aiUrgency: 0.95,
    aiReason: "Chemical discharge detected",
  };

  const silentOut = applyAiDisplayMode(sampleReport, { ai_governance: { display_mode: "silent" } });
  assert.equal(silentOut.aiCategory, null);
  assert.equal(silentOut.aiSeverity, null);
  assert.equal(silentOut.aiReason, null);

  const assistedOut = applyAiDisplayMode(sampleReport, { ai_governance: { display_mode: "assisted" } });
  assert.equal(assistedOut.aiCategory, "Emergency");
  assert.equal(assistedOut.aiSeverity, "Critical");
});
