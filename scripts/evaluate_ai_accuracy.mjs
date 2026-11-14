#!/usr/bin/env node
// Evaluates AI suggestion accuracy against human officer actions
// Author: MarkDanielsMCraft

import { query, getPool } from "../lib/db.js";

async function runEvaluation() {
  console.log("Starting AI Accuracy and Silent Test Evaluation...");

  try {
    const res = await query(`
      SELECT 
        a.report_id,
        a.suggested_category AS "aiCategory",
        a.tier_executed AS "tier",
        a.latency_ms AS "latency",
        r.triage_category AS "officerCategory",
        r.status AS "reportStatus"
      FROM ai_assessments a
      JOIN reports r ON r.id = a.report_id
      WHERE a.is_latest = true
        AND r.triage_category IS NOT NULL
    `);

    const rows = res?.rows || [];
    if (rows.length === 0) {
      console.log("No human-triaged reports found yet to compare against AI assessments.");
      console.log("Status: 0 completed comparisons. Baseline data collection in progress.");
      return;
    }

    let matches = 0;
    let officerEmergencies = 0;
    let aiCaughtEmergencies = 0;
    let aiEmergencies = 0;
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let totalLatency = 0;
    let latencyCount = 0;

    for (const r of rows) {
      if (r.tier && tierCounts[r.tier] !== undefined) {
        tierCounts[r.tier]++;
      }
      if (r.latency != null) {
        totalLatency += r.latency;
        latencyCount++;
      }

      if (r.aiCategory === r.officerCategory) {
        matches++;
      }

      if (r.officerCategory === "Emergency") {
        officerEmergencies++;
        if (r.aiCategory === "Emergency") {
          aiCaughtEmergencies++;
        }
      }

      if (r.aiCategory === "Emergency") {
        aiEmergencies++;
      }
    }

    const agreementRate = ((matches / rows.length) * 100).toFixed(1);
    const emergencyRecall = officerEmergencies > 0
      ? (((aiCaughtEmergencies / officerEmergencies) * 100).toFixed(1) + "%")
      : "No emergencies in period";
    const avgLatency = latencyCount > 0
      ? (totalLatency / latencyCount).toFixed(0) + " ms"
      : "N/A";

    console.log("--------------------------------------------------");
    console.log(`Total Reports Evaluated: ${rows.length}`);
    console.log(`Officer Agreement Rate: ${agreementRate}%`);
    console.log(`Emergency Recall: ${emergencyRecall}`);
    console.log(`Average AI Latency: ${avgLatency}`);
    console.log("Execution Tier Distribution:");
    console.log(`  Tier 1 (Cloud Gemini): ${tierCounts[1]}`);
    console.log(`  Tier 2 (Local Small Model): ${tierCounts[2]}`);
    console.log(`  Tier 3 (Local Keyword Rules): ${tierCounts[3]}`);
    console.log(`  Tier 4 (Baseline Weights): ${tierCounts[4]}`);
    console.log("--------------------------------------------------");

    const agreementOk = parseFloat(agreementRate) >= 80.0;
    const recallRate = officerEmergencies > 0 ? aiCaughtEmergencies / officerEmergencies : 1.0;
    const recallOk = recallRate >= 0.95;

    if (agreementOk && recallOk) {
      console.log("Result: PASS. Silent run exceeds the 80% officer agreement and 95% emergency recall thresholds.");
    } else if (!recallOk) {
      console.log("Result: FAIL. Emergency recall is below the mandatory 95% safety threshold.");
    } else {
      console.log("Result: IN PROGRESS. Silent run is below 80% agreement threshold.");
    }
  } catch (err) {
    console.error("Evaluation failed:", err.message);
  } finally {
    if (process.env.DATABASE_URL) {
      const pool = getPool();
      if (pool && typeof pool.end === "function") {
        await pool.end().catch(() => {});
      }
    }
  }
}

runEvaluation();
