#!/usr/bin/env node
// Prepares verified local training data for model training inside Uganda
// Author: MarkDanielsMCraft

import fs from "node:fs";
import path from "node:path";
import { query, getPool } from "../lib/db.js";
import { quantizeCoordinates, sanitizeCitizenNote } from "../lib/ai/fallbackEngine.js";

async function prepareDataset() {
  console.log("Extracting verified inspection records for local model training...");

  try {
    const res = await query(`
      SELECT 
        r.id,
        r.lat,
        r.lng,
        r.type,
        r.note,
        r.photo_url AS "photoUrl",
        r.triage_category AS "groundTruthCategory",
        r.inspected_at AS "inspectedAt",
        r.ts AS "timestamp",
        f.certificate_number AS "certificateNumber",
        f.water_ph AS "waterPh",
        f.water_clarity AS "waterClarity",
        f.odor AS "odor",
        f.action_recommended AS "actionRecommended"
      FROM reports r
      LEFT JOIN field_inspections f ON f.report_id = r.id
      WHERE r.inspected_at IS NOT NULL
        AND r.triage_category IS NOT NULL
      ORDER BY r.inspected_at ASC
    `);

    const rows = res?.rows || [];
    console.log(`Found ${rows.length} verified physical inspection records.`);

    const seen = new Set();
    const cleanDataset = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const q = quantizeCoordinates(row.lat, row.lng);
      cleanDataset.push({
        id: row.id,
        lat: q ? q.lat : null,
        lng: q ? q.lng : null,
        type: row.type || "Other",
        note: sanitizeCitizenNote(row.note),
        photoUrl: row.photoUrl || null,
        category: row.groundTruthCategory,
        certificateNumber: row.certificateNumber || null,
        waterPh: row.waterPh != null ? Number(row.waterPh) : null,
        waterClarity: row.waterClarity || null,
        odor: row.odor || null,
        actionRecommended: row.actionRecommended || null,
        timestamp: Number(row.timestamp) || Date.now(),
        inspectedAt: row.inspectedAt,
      });
    }

    const outDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outFile = path.join(outDir, "training_reports.json");
    fs.writeFileSync(outFile, JSON.stringify(cleanDataset, null, 2), "utf8");
    console.log(`Successfully exported ${cleanDataset.length} training examples to: ${outFile}`);
  } catch (err) {
    console.error("Dataset preparation failed:", err.message);
  } finally {
    if (process.env.DATABASE_URL) {
      const pool = getPool();
      if (pool && typeof pool.end === "function") {
        await pool.end().catch(() => {});
      }
    }
  }
}

prepareDataset();
