import test from "node:test";
import assert from "node:assert/strict";
import { distanceM } from "../lib/geo.js";
import { query } from "../lib/db.js";
import { slaInfo } from "../lib/sla.js";
import { ensureAiTables } from "../lib/schema.js";

test("distanceM calculates Haversine distance accurately", () => {
  const spotA = { lat: 0.3150, lng: 32.5810 };
  const spotB = { lat: 0.3150, lng: 32.5810 };
  assert.equal(distanceM(spotA, spotB), 0);

  // ~111 meters North (0.001 degrees lat)
  const spotNorth100m = { lat: 0.3160, lng: 32.5810 };
  const dist = distanceM(spotA, spotNorth100m);
  assert.ok(dist >= 110 && dist <= 112);

  // ~333 meters North (0.003 degrees lat) -> exceeds 200m
  const spotNorth300m = { lat: 0.3180, lng: 32.5810 };
  const distFar = distanceM(spotA, spotNorth300m);
  assert.ok(distFar > 300);
});

test("distanceM handles invalid, missing, or null coordinates gracefully", () => {
  assert.equal(distanceM(null, { lat: 0, lng: 0 }), Infinity);
  assert.equal(distanceM({ lat: 0, lng: 0 }, null), Infinity);
  assert.equal(distanceM({ lat: null, lng: 0 }, { lat: 0, lng: 0 }), Infinity);
});

test("Section 107 field inspection record inserts and updates report state", async () => {
  await ensureAiTables().catch(() => {});

  const reportId = `test-insp-rep-${Date.now()}`;
  const now = Date.now();

  // Create test report in Emergency category needing inspection
  await query(
    `INSERT INTO reports (id, lat, lng, type, note, status, category, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [reportId, 0.3150, 32.5810, "Industrial Waste", "Toxic discharge near wetland", "viewed", "Emergency", now],
  );

  // Prior to inspection, Emergency report is in 'inspect' stage
  const preSla = slaInfo({
    status: "viewed",
    category: "Emergency",
    receivedAt: now,
    inspectedAt: null,
  });
  assert.equal(preSla.stage, "inspect");

  // Ranger is 45 meters away (well within 200m threshold)
  const rangerLat = 0.3154;
  const rangerLng = 0.325810;
  const dist = distanceM({ lat: 0.3150, lng: 32.5810 }, { lat: rangerLat, lng: 32.5810 });
  assert.ok(dist < 200);

  const inspectionId = `insp-${Date.now()}`;
  const certNumber = "NEMA/SEC107/2026/0099";

  await query(
    `INSERT INTO field_inspections (
      id, report_id, ranger_email, certificate_number,
      lat, lng, distance_m, photo_url,
      water_ph, water_clarity, odor,
      findings_summary, action_recommended
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      inspectionId,
      reportId,
      "ranger.kigozi@nema.gov",
      certNumber,
      rangerLat,
      32.5810,
      dist,
      "https://example.com/site.jpg",
      4.2,
      "chemical_opaque",
      "chemical_solvent",
      "Observed acidic chemical spill from culvert",
      "stop_notice",
    ],
  );

  // Update report inspected_at
  await query(
    `UPDATE reports SET inspected_at = now(), inspected_by = $2 WHERE id = $1`,
    [reportId, "ranger.kigozi@nema.gov"],
  );

  // Fetch the inspection record
  const res = await query(
    `SELECT * FROM field_inspections WHERE report_id = $1`,
    [reportId],
  );
  assert.equal(res.rows.length, 1);
  const insp = res.rows[0];
  assert.equal(insp.certificate_number, certNumber);
  assert.equal(insp.ranger_email, "ranger.kigozi@nema.gov");
  assert.equal(Number(insp.water_ph), 4.2);
  assert.equal(insp.action_recommended, "stop_notice");

  // Post-inspection, report stage transitions to 'decide'
  const postSla = slaInfo({
    status: "viewed",
    category: "Emergency",
    receivedAt: now,
    inspectedAt: Date.now(),
  });
  assert.equal(postSla.stage, "decide");
});

test("forced inspections store forced boolean and written administrative justification", async () => {
  await ensureAiTables().catch(() => {});

  const reportId = `test-insp-forced-${Date.now()}`;
  const now = Date.now();

  await query(
    `INSERT INTO reports (id, lat, lng, type, note, status, category, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [reportId, 0.3150, 32.5810, "Wetland Encroachment", "Illegal trenching", "viewed", "Enforcement", now],
  );

  const inspectionId = `insp-forced-${Date.now()}`;
  const certNumber = "NEMA/SEC107/2026/0100";
  const forceReason = "GPS signal blocked by dense papyrus canopy; verified on-site via photo";

  await query(
    `INSERT INTO field_inspections (
      id, report_id, ranger_email, certificate_number,
      lat, lng, distance_m, photo_url,
      water_ph, water_clarity, odor,
      findings_summary, action_recommended, forced, force_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      inspectionId,
      reportId,
      "admin@nema.gov",
      certNumber,
      0.3200,
      32.5850,
      600, // Distance > 300m forced by admin
      null,
      null,
      "clear",
      "natural_earth",
      "Excavator tracks observed",
      "restoration_order",
      true,
      forceReason,
    ],
  );

  const res = await query(
    `SELECT forced, force_reason FROM field_inspections WHERE id = $1`,
    [inspectionId],
  );
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].forced, true);
  assert.equal(res.rows[0].force_reason, forceReason);
});
