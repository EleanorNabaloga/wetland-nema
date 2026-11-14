import test from "node:test";
import assert from "node:assert/strict";
import { 
  computeSeasonalFeatures, 
  extractTextFeatures, 
  classifyWithLocalModel 
} from "../lib/ai/localEngine.js";
import { executeTier2 } from "../lib/ai/fallbackEngine.js";

test("computeSeasonalFeatures accurately models Uganda bimodal seasons", () => {
  // Month 4: April (primary rainy season)
  // Date constructor with UTC month 3 (0-indexed) = April
  const aprilDate = new Date("2026-04-15T12:00:00Z").getTime();
  const april = computeSeasonalFeatures(aprilDate);
  assert.equal(april.month, 4);
  assert.equal(april.isWetSeason, true);
  assert.equal(april.sinMonth, 1);

  // Month 1: January (dry season)
  const janDate = new Date("2026-01-15T12:00:00Z").getTime();
  const jan = computeSeasonalFeatures(janDate);
  assert.equal(jan.month, 1);
  assert.equal(jan.isWetSeason, false);
  assert.equal(jan.cosMonth, 1);

  // Month 10: October (secondary rainy season)
  const octDate = new Date("2026-10-15T12:00:00Z").getTime();
  const oct = computeSeasonalFeatures(octDate);
  assert.equal(oct.month, 10);
  assert.equal(oct.isWetSeason, true);
  assert.equal(oct.sinMonth, -1);
});

test("extractTextFeatures detects English and Luganda emergency patterns with negation", () => {
  // Luganda emergency
  const f1 = extractTextFeatures("Abantu bafulumya obutwa okuva mu makolero");
  assert.equal(f1.hasEmergencyToxic, true);
  assert.equal(f1.hasNegation, false);

  // Luganda negated emergency
  const f2 = extractTextFeatures("Amazzi gano g'amataba, ssi butwa okuva mu makolero");
  assert.equal(f2.hasEmergencyToxic, true);
  assert.equal(f2.hasNegation, true);

  // Enforcement excavation
  const f3 = extractTextFeatures("Bateeka ettaka n'okutema emiti mu lutobazi");
  assert.equal(f3.hasEnforcementEncroach, true);
  assert.equal(f3.hasEnforcementNegation, false);
});

test("classifyWithLocalModel prioritizes Emergency and achieves high recall", async () => {
  const emergencyReport = {
    type: "Chemical dumping",
    note: "Severe toxic industrial chemicals spilling into Lubigi wetland",
    ts: Date.now(),
  };

  const res = await classifyWithLocalModel(emergencyReport);
  assert.equal(res.category, "Emergency");
  assert.equal(res.severity, "Critical");
  assert.equal(res.tier, 2);
  assert.ok(res.confidence >= 0.70);
  assert.ok(res.latency_ms < 60, "Must execute in under 60ms on CPU");
});

test("classifyWithLocalModel avoids false emergencies on muddy wet season runoff", async () => {
  // During April (wet season), natural red mud runoff
  const aprilDate = new Date("2026-04-15T12:00:00Z").getTime();
  const runoffReport = {
    type: "Storm runoff",
    note: "Heavy rain flooding red mud water, no chemical smell",
    ts: aprilDate,
  };

  const res = await classifyWithLocalModel(runoffReport);
  assert.notEqual(res.category, "Emergency");
  assert.equal(res.tier, 2);
});

test("executeTier2 integration resolves properly with local engine", async () => {
  const report = {
    type: "Wetland encroachment",
    note: "Excavator clearing papyrus to build commercial warehouse",
  };

  const res = await executeTier2(report);
  assert.ok(res);
  assert.equal(res.category, "Enforcement");
  assert.equal(res.tier, 2);
  assert.equal(res.model_id, "wetland-small-cpu-v1");
  assert.ok(typeof res.summary === "string" && res.summary.length > 0);
  assert.ok(Array.isArray(res.tags) && res.tags.length > 0);
});

test("localEngine handles null and invalid timestamps or text safely", () => {
  const sNull = computeSeasonalFeatures(null);
  assert.ok(Number.isFinite(sNull.month) && sNull.month >= 1 && sNull.month <= 12);
  assert.ok(Number.isFinite(sNull.sinMonth) && Number.isFinite(sNull.cosMonth));

  const sBad = computeSeasonalFeatures("not-a-date");
  assert.ok(Number.isFinite(sBad.month) && sBad.month >= 1 && sBad.month <= 12);

  const fNull = extractTextFeatures(null);
  assert.equal(fNull.wordCount, 0);
  assert.equal(fNull.hasEmergencyToxic, false);
});
