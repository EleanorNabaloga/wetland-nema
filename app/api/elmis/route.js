import { NextResponse } from "next/server";
import { query, logAudit, withTransaction } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { checkPermitStatus, syncCaseToElmis, generateChainOfCustodyPackage } from "@/lib/elmis";

export const dynamic = "force-dynamic";

const json = (body, status = 200) => NextResponse.json(body, { status });
const READ_ROLES = ["reviewer", "inspector", "legal", "admin", "oversight"];
const WRITE_ROLES = ["reviewer", "inspector", "legal", "admin"];

export async function GET(req) {
  try {
    const user = await requireRole(req, READ_ROLES);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("reportId");

    if (!reportId) {
      return json({ error: "reportId is required" }, 400);
    }

    const dossier = await generateChainOfCustodyPackage(reportId);
    if (!dossier) {
      return json({ error: "Report not found" }, 404);
    }

    return json(dossier);
  } catch (err) {
    console.error("[elmis] GET failed:", err);
    return json({ error: "Server error" }, 500);
  }
}

export async function POST(req) {
  try {
    const user = await requireRole(req, WRITE_ROLES);
    if (!user) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { reportId } = body;

    if (!reportId) {
      return json({ error: "reportId is required" }, 400);
    }

    // 1. Fetch current report and latest inspection
    const repRes = await query(
      `SELECT id, lat, lng, acc, type, triage_category AS category,
              status, elmis_sync_id AS "elmisSyncId"
       FROM reports WHERE id = $1`,
      [reportId],
    );

    if (!repRes.rows.length) {
      return json({ error: "Report not found" }, 404);
    }

    const report = repRes.rows[0];

    // Check if already synced
    if (report.elmisSyncId) {
      return json({
        ok: true,
        alreadySynced: true,
        elmisSyncId: report.elmisSyncId,
        message: `Case already synchronized to ELMIS as #${report.elmisSyncId}`,
      });
    }

    // Ensure report has at least been triaged
    if (!report.category) {
      return json({
        error: "Report must be assigned a priority category before syncing to ELMIS",
      }, 400);
    }

    const inspRes = await query(
      `SELECT certificate_number, ranger_email, water_ph, water_clarity,
              odor, action_recommended, distance_m
       FROM field_inspections
       WHERE report_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [reportId],
    );

    const inspection = inspRes.rows[0] || null;

    // 2. Dispatch to ELMIS
    const syncResult = await syncCaseToElmis(report, inspection, user.email);

    // 3. Record sync atomically in database
    await withTransaction(async (run) => {
      await run(
        `UPDATE reports SET elmis_sync_id = $1, elmis_synced_at = now() WHERE id = $2`,
        [syncResult.elmisId, reportId],
      );
      await logAudit(
        reportId,
        user.email,
        "SYNCED_ELMIS",
        { elmisId: syncResult.elmisId, syncedAt: syncResult.syncedAt },
        run,
      );
    });

    return json({
      ok: true,
      elmisSyncId: syncResult.elmisId,
      syncedAt: syncResult.syncedAt,
    });
  } catch (err) {
    console.error("[elmis] POST failed:", err);
    return json({ error: "Server error" }, 500);
  }
}
