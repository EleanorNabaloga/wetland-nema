import test from "node:test";
import assert from "node:assert/strict";
import { 
  executeTier1,
  executeTier3, 
  executeTier4, 
  executeAiTriage, 
  quantizeCoordinates, 
  sanitizeCitizenNote 
} from "../lib/ai/fallbackEngine.js";
import { CATEGORIES } from "../lib/sla.js";

test("quantizeCoordinates truncates to 3 decimal places (~110m)", () => {
  const result = quantizeCoordinates(0.3405123, 32.5419456);
  assert.deepEqual(result, { lat: 0.341, lng: 32.542 });
  assert.equal(quantizeCoordinates(null, null), null);
});

test("sanitizeCitizenNote scrubs formatted phone numbers, NINs, and email addresses", () => {
  const raw = "Call +256 772 123 456 or 0701-987-654, NIN is CM123456789ABC, email test@example.com immediately";
  const sanitized = sanitizeCitizenNote(raw);
  assert.ok(!sanitized.includes("0772 123 456"));
  assert.ok(!sanitized.includes("0701-987-654"));
  assert.ok(!sanitized.includes("CM123456789ABC"));
  assert.ok(!sanitized.includes("test@example.com"));
  assert.ok(sanitized.includes("[REDACTED_CONTACT]"));
  assert.ok(sanitized.includes("[REDACTED_NIN]"));
  assert.ok(sanitized.includes("[REDACTED_EMAIL]"));
});

test("executeTier3 respects negation and avoids false emergency triggers", () => {
  const negatedReport = {
    id: "TEST-NEG-01",
    type: "Other",
    note: "This is not toxic chemical waste, it is just red mud from heavy rain"
  };
  const res = executeTier3(negatedReport);
  assert.notEqual(res.category, "Emergency", "Negated toxic phrase must not trigger Emergency category");

  // Luganda grammatical negation: "ssi butwa" = "not poison"
  const negatedLuganda = {
    id: "TEST-NEG-02",
    type: "Other",
    note: "Amazzi gano g'amataba, ssi butwa"
  };
  const resLuganda = executeTier3(negatedLuganda);
  assert.notEqual(resLuganda.category, "Emergency", "Luganda ssi butwa must not trigger Emergency category");
});

test("executeTier3 identifies Luganda emergency and enforcement keywords", () => {
  // Luganda toxic industrial spill
  const report1 = {
    id: "TEST-01",
    type: "Other",
    note: "Abantu bafulumya obutwa obukaawa okuva mu makolero mu lutobazi lw'e Lubigi"
  };
  const res1 = executeTier3(report1);
  assert.equal(res1.category, "Emergency");
  assert.ok(res1.urgency >= 0.85);
  assert.ok(CATEGORIES.includes(res1.category));

  // Luganda domestic waste (kasasiro)
  const report2 = {
    id: "TEST-02",
    type: "Other",
    note: "Kasasiro mungi nnyo n'ebiveera bikutte omwala"
  };
  const res2 = executeTier3(report2);
  assert.equal(res2.category, "Referral");
  assert.ok(CATEGORIES.includes(res2.category));
});

test("executeTier4 gracefully falls back to existing type weights", () => {
  const sewerReport = { type: "Sewage", note: "" };
  const resSewer = executeTier4(sewerReport);
  assert.equal(resSewer.category, "Emergency");
  assert.equal(resSewer.tier, 4);

  const rubbishReport = { type: "Rubbish or waste", note: "" };
  const resRubbish = executeTier4(rubbishReport);
  assert.equal(resRubbish.category, "Referral");
  assert.equal(resRubbish.tier, 4);
});

test("executeAiTriage orchestrator resolves without throwing", async () => {
  const report = {
    id: "REPORT-99",
    type: "Oil or chemicals",
    note: "Factory pipe leaking black sludge into the stream",
    lat: 0.32,
    lng: 32.55
  };
  const outcome = await executeAiTriage(report);
  assert.ok(outcome.category);
  assert.ok(CATEGORIES.includes(outcome.category));
  assert.ok(outcome.urgency > 0);
  assert.ok(outcome.tier >= 1 && outcome.tier <= 4);
});

test("executeAiTriage handles null or empty inputs gracefully", async () => {
  const outcomeNull = await executeAiTriage(null);
  assert.ok(outcomeNull.category);
  assert.equal(outcomeNull.category, "Insufficient");
  assert.equal(outcomeNull.tier, 3);

  const tier4Null = executeTier4(null);
  assert.ok(tier4Null.category);
  assert.equal(tier4Null.tier, 4);

  const outcomeEmpty = await executeAiTriage({});
  assert.ok(outcomeEmpty.category);
  assert.equal(outcomeEmpty.tier, 3);
});

test("executeAiTriage passes custom regional keywords to Tier 3", async () => {
  const customSettings = {
    language_keywords: {
      emergency_runyankole: ["oburogo_custom"],
    },
  };
  const report = {
    id: "REGIONAL-01",
    type: "Other",
    note: "Abantu bareeta oburogo_custom omu mugga",
  };
  const outcome = await executeAiTriage(report, customSettings);
  assert.equal(outcome.category, "Emergency");
  assert.equal(outcome.tier, 3);
});

test("executeTier1 is disabled by default and requires explicit cloud_ai_enabled setting", async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-test-key";
  try {
    const report = {
      id: "CLOUD-TEST-01",
      type: "Oil or chemicals",
      note: "Toxic dump",
      photo: "data:image/jpeg;base64,12345",
    };

    // Disabled when settings is null
    const resNoSettings = await executeTier1(report, null);
    assert.equal(resNoSettings, null);

    // Disabled when cloud_ai_enabled is false
    const resDisabled = await executeTier1(report, { ai_governance: { cloud_ai_enabled: false } });
    assert.equal(resDisabled, null);
  } finally {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});
