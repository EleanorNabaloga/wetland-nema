import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPermitStatus,
  syncCaseToElmis,
  generateChainOfCustodyPackage,
} from "../lib/elmis.js";
import { query } from "../lib/db.js";

test("checkPermitStatus handles missing or invalid coordinates gracefully", async () => {
  const result = await checkPermitStatus(null);
  assert.equal(result.hasPermit, false);
  assert.equal(result.status, "No Coordinates");

  const invalid = await checkPermitStatus({ lat: "not-a-number", lng: null });
  assert.equal(invalid.hasPermit, false);
  assert.equal(invalid.status, "No Coordinates");
});

test("checkPermitStatus detects active wetland user permit in local registry", async () => {
  // Lubigi drainage maintenance permit coordinates: lat: 0.334, lng: 32.545
  const result = await checkPermitStatus({ lat: 0.3341, lng: 32.5451 }, "Sewer spill");
  assert.equal(result.hasPermit, true);
  assert.equal(result.permitNumber, "NEMA/WET/2026/042");
  assert.equal(result.status, "Active");
  assert.ok(result.distanceM <= 500);
});

test("checkPermitStatus detects expired or revoked permits with warning message", async () => {
  // Munyonyo expired permit: lat: 0.238, lng: 32.622
  const result = await checkPermitStatus({ lat: 0.2382, lng: 32.6221 }, "Wetland encroachment");
  assert.equal(result.hasPermit, true);
  assert.equal(result.permitNumber, "NEMA/WET/2025/119");
  assert.equal(result.status, "Expired");
  assert.match(result.message, /Expired/);
});

test("checkPermitStatus returns No Permit on unknown coordinates", async () => {
  const result = await checkPermitStatus({ lat: 1.500, lng: 33.200 }, "Encroachment");
  assert.equal(result.hasPermit, false);
  assert.equal(result.status, "No Permit On File");
});

test("syncCaseToElmis creates standardized ELMIS synchronization payload", async () => {
  const mockReport = {
    id: "NEMA-test-101",
    lat: 0.334,
    lng: 32.545,
    acc: 12,
    type: "Sewer spill",
    category: "Emergency",
  };
  const mockInspection = {
    certificateNumber: "NEMA/SEC107/2026/999",
    rangerEmail: "ranger@nema.gov",
    waterPh: 6.8,
    waterClarity: "murky_clay",
    odor: "raw_sewage",
    actionRecommended: "stop_notice",
    distanceM: 45,
  };

  const res = await syncCaseToElmis(mockReport, mockInspection, "officer@nema.gov");
  assert.equal(res.success, true);
  assert.equal(res.elmisId, "ELMIS-test-101");
  assert.ok(res.syncedAt);
  assert.equal(res.payload.caseId, "NEMA-NEMA-test-101");
  assert.equal(res.payload.inspection.certificateNumber, "NEMA/SEC107/2026/999");
  assert.equal(res.payload.inspection.waterPh, 6.8);
});

test("generateChainOfCustodyPackage generates valid Section 107 evidentiary dossier", async () => {
  // Insert a test report with inspection into the database
  const repId = `test-dossier-${Date.now()}`;
  await query(
    `INSERT INTO reports (id, lat, lng, acc, ts, type, note, hash, status, triage_category)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      repId,
      0.334,
      32.545,
      15,
      Date.now() - 3600000,
      "Sewer spill",
      "Broken sewer line near Lubigi channel",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "viewed",
      "Emergency",
    ],
  );

  await query(
    `INSERT INTO field_inspections (id, report_id, ranger_email, certificate_number, lat, lng, distance_m, photo_url, water_ph, water_clarity, odor, findings_summary, action_recommended, forced, force_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      `insp-${repId}`,
      repId,
      "ranger.lubigi@nema.gov",
      "NEMA/SEC107/2026/088",
      0.3341,
      32.5451,
      25,
      null,
      4.5,
      "chemical_opaque",
      "raw_sewage",
      "Industrial discharge observed entering wetland.",
      "stop_notice",
      false,
      null,
    ],
  );

  const dossier = await generateChainOfCustodyPackage(repId);
  assert.ok(dossier);
  assert.equal(dossier.caseId, `NEMA-${repId}`);
  assert.equal(dossier.legalStatute, "National Environment Act 2019, Section 107");
  assert.equal(dossier.evidenceSummary.threatType, "Sewer spill");
  assert.equal(dossier.evidenceSummary.tamperProofPhotoHash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(dossier.fieldInspection.verifiedOnSite, true);
  assert.equal(dossier.fieldInspection.certificateNumber, "NEMA/SEC107/2026/088");
  assert.equal(dossier.fieldInspection.waterTestReadings.pH, 4.5);
  assert.equal(dossier.fieldInspection.rangerCoordinates.verifiedWithin200m, true);
  assert.ok(dossier.elmisStatus.permitCrossReference);
});
