// Four-Tier Fallback Priority Engine

import { weightOf } from "../hotspots.js";
import { CATEGORIES } from "../sla.js";
import { trackBlockedAction } from "../observability.js";
import { classifyWithLocalModel } from "./localEngine.js";
import { quantizeCoordinates, sanitizeCitizenNote } from "./sanitize.js";

export { quantizeCoordinates, sanitizeCitizenNote };

// Tier 1: Cloud Multimodal Assistant (Google Gemini) with strict 1800ms timeout
// OFF by default. Requires DPIA and NEMA MoU approval before sending data to external APIs.
// Never sends photos to external services — only sanitized notes and report types.
export async function executeTier1(report, settings = null) {
  if (!settings?.ai_governance?.cloud_ai_enabled) {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const parts = [
      {
        text: `You are an environmental priority sorting assistant for the National Environment Management Authority (NEMA) in Uganda.
Classify this citizen wetland pollution report into one of five categories:
- Emergency: immediate chemical spill, severe toxic dumping, or active sewer burst
- Enforcement: illegal wetland filling, encroachment, excavating, building, or clearing
- Referral: municipal household garbage, plastic waste, or non-wetland dumping
- Duplicate: identical report already reported
- Insufficient: vague or lacking any useful evidence

Report Details:
Type: ${report.type || "Unknown"}
Note: ${report.note || "No note provided"}
Location Box: ${report.lat != null ? `${report.lat}, ${report.lng}` : "Not provided"}

Respond ONLY with valid JSON in this exact structure:
{
  "category": "Emergency" | "Enforcement" | "Referral" | "Duplicate" | "Insufficient",
  "urgency": number between 0.0 and 1.0,
  "confidence": number between 0.0 and 1.0,
  "tags": ["short_tag_1", "short_tag_2"],
  "summary": "one simple plain English sentence explaining the priority"
}`,
      },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(1800),
      },
    );

    if (!res.ok) return null;
    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    if (!CATEGORIES.includes(parsed.category)) return null;

    return {
      category: parsed.category,
      urgency: Math.max(0, Math.min(1, Number(parsed.urgency) || 0.5)),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : ["gemini_ai"],
      summary: String(parsed.summary || "Cloud AI assessment completed.").slice(0, 300),
      tier: 1,
      externalTransmitted: true,
    };
  } catch (err) {
    trackBlockedAction("ai_fallback_engine", "tier1_aborted_or_failed", {
      id: report.id,
      reason: err.message,
    });
    return null;
  }
}

// Tier 2: Local Small Server Model (<60ms CPU execution inside Uganda)
export async function executeTier2(report) {
  try {
    return await classifyWithLocalModel(report);
  } catch (err) {
    return null;
  }
}


function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeyword(text, term) {
  const escaped = escapeRegExp(term);
  return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i").test(text);
}

// Tier 3: Deterministic Luganda, regional languages, and English regular expression engine
export function executeTier3(report, settings = null) {
  const safe = report || {};
  const cleanNote = sanitizeCitizenNote(safe.note);
  const text = `${safe.type || ""} ${cleanNote}`.toLowerCase();

  const kw = settings?.language_keywords || {};
  const regionalEmergency = [
    ...(kw.emergency_luganda || []),
    ...(kw.emergency_english || []),
    ...(kw.emergency_runyankole || []),
    ...(kw.emergency_acholi || []),
    ...(kw.emergency_ateso || []),
    ...(kw.luganda?.emergency || []),
    ...(kw.runyankole?.emergency || []),
    ...(kw.acholi?.emergency || []),
    ...(kw.ateso?.emergency || []),
  ].map((w) => String(w).toLowerCase()).filter(Boolean);

  const regionalEnforcement = [
    ...(kw.enforcement_luganda || []),
    ...(kw.enforcement_english || []),
    ...(kw.luganda?.enforcement || []),
    ...(kw.runyankole?.enforcement || []),
    ...(kw.acholi?.enforcement || []),
    ...(kw.ateso?.enforcement || []),
  ].map((w) => String(w).toLowerCase()).filter(Boolean);

  const regionalReferral = [
    ...(kw.referral_luganda || []),
    ...(kw.referral_english || []),
    ...(kw.luganda?.referral || []),
    ...(kw.runyankole?.referral || []),
    ...(kw.acholi?.referral || []),
    ...(kw.ateso?.referral || []),
  ].map((w) => String(w).toLowerCase()).filter(Boolean);

  // Negation filter: check if emergency or enforcement terms are preceded by negation words
  // e.g., "not toxic", "no chemical", "ssi butwa" (not poison), "tewali butwa" (no poison)
  const isNegatedEmergency = /(?:not|no|ssi|si|tewali|tekiri)\s+(?:\w+\s+){0,2}(?:toxic|chemical|sewer|sewage|burst|poison|(?:o)?butwa|(?:a)?makolero|kazambi|(?:o)?bukyafu)/i.test(text);
  const isNegatedEnforcement = /(?:not|no|ssi|si|tewali|tekiri)\s+(?:\w+\s+){0,2}(?:encroach|excavat|clearing|okutema|okuzimba|lutobazi|ntobazi)/i.test(text);

  // High urgency toxic or sewer patterns
  const matchesEmergency = /toxic|chemical|sewer|sewage|burst|poison|(?:o)?butwa|(?:a)?makolero|kazambi|(?:o)?bukyafu/.test(text) || regionalEmergency.some((term) => matchesKeyword(text, term));
  const isEmergency = matchesEmergency && !isNegatedEmergency;

  // Enforcement encroachment patterns
  const matchesEnforcement = /encroach|excavat|fill|dumping soil|clearing|lutobazi|ntobazi|okutema|ettaka|okuzimba|emiti/.test(text) || regionalEnforcement.some((term) => matchesKeyword(text, term));
  const isEnforcement = matchesEnforcement && !isNegatedEnforcement;

  // Municipal rubbish patterns
  const isReferral = /kasasiro|rubbish|plastic|garbage|litter|waste|ebiveera/.test(text) || regionalReferral.some((term) => matchesKeyword(text, term));

  if (isEmergency) {
    return {
      category: "Emergency",
      urgency: 0.90,
      confidence: 0.85,
      tags: ["regex_rule", "emergency_chemical_sewer"],
      summary: "Rule matched emergency toxic or sewage keywords.",
      tier: 3
    };
  }

  if (isEnforcement) {
    return {
      category: "Enforcement",
      urgency: 0.65,
      confidence: 0.80,
      tags: ["regex_rule", "wetland_encroachment"],
      summary: "Rule matched wetland encroachment or clearing keywords.",
      tier: 3
    };
  }

  if (isReferral) {
    return {
      category: "Referral",
      urgency: 0.35,
      confidence: 0.75,
      tags: ["regex_rule", "municipal_kasasiro"],
      summary: "Rule matched domestic kasasiro or plastic waste keywords.",
      tier: 3
    };
  }

  return {
    category: "Insufficient",
    urgency: 0.20,
    confidence: 0.40,
    tags: ["regex_rule", "insufficient_detail"],
    summary: "Rule fallback could not determine severe keywords.",
    tier: 3
  };
}

// Tier 4: Base SLA and Type Weights (Fail-Safe Backup Rules)
export function executeTier4(report, customWeights = null) {
  const safe = report || {};
  const baseWeight = weightOf(safe, customWeights);
  let category = "Referral";
  let urgency = 0.30;

  if (baseWeight >= 8) {
    category = "Emergency";
    urgency = 0.85;
  } else if (baseWeight >= 4) {
    category = "Enforcement";
    urgency = 0.60;
  }

  return {
    category,
    urgency,
    confidence: 0.50,
    tags: ["system_default_weight", `weight_${baseWeight}`],
    summary: "AI offline. Priority set from baseline report type weights.",
    tier: 4
  };
}

// Master Coordinator: Cascades through tiers with bounded fallbacks
export async function executeAiTriage(report, settings = null) {
  const safe = report || {};
  const quantized = quantizeCoordinates(safe.lat, safe.lng);
  const sanitizedReport = {
    ...safe,
    note: sanitizeCitizenNote(safe.note),
    lat: quantized ? quantized.lat : null,
    lng: quantized ? quantized.lng : null,
  };

  const weights = settings?.hotspot_weights || null;

  // Tier 1: Cloud Multimodal Assistant (Google Gemini, 1800ms bounded, off by default)
  try {
    const t1Result = await executeTier1(sanitizedReport, settings);
    if (t1Result && CATEGORIES.includes(t1Result.category)) {
      return t1Result;
    }
  } catch (err1) {
    trackBlockedAction("ai_fallback_engine", "tier1_failed", {
      id: sanitizedReport.id,
      reason: err1.message,
    });
  }

  // Tier 2: Local Small Server Model (<60ms CPU execution inside Uganda)
  try {
    const t2Result = await executeTier2(sanitizedReport);
    if (t2Result && t2Result.category !== "Insufficient" && CATEGORIES.includes(t2Result.category)) {
      return t2Result;
    }
  } catch (err2) {
    trackBlockedAction("ai_fallback_engine", "tier2_failed", {
      id: sanitizedReport.id,
      reason: err2.message,
    });
  }

  // Tier 3: Deterministic Luganda and English heuristics
  try {
    const t3Result = executeTier3(sanitizedReport, settings);
    // If Tier 3 successfully matched emergency, enforcement, or referral keywords, return it.
    // If keywords were insufficient but the report's baseline type carries significant weight,
    // cascade cleanly to Tier 4 so that severe types are not lost.
    if (t3Result && t3Result.category !== "Insufficient") {
      return t3Result;
    }
    if (t3Result && t3Result.category === "Insufficient" && weightOf(sanitizedReport, weights) >= 4) {
      return executeTier4(sanitizedReport, weights);
    }
    return t3Result || executeTier4(sanitizedReport, weights);
  } catch (err3) {
    trackBlockedAction("ai_fallback_engine", "tier3_failed", {
      id: sanitizedReport.id,
      reason: err3.message,
    });
  }

  // Tier 4: Fail-Safe Backup Rules
  return executeTier4(sanitizedReport, weights);
}
