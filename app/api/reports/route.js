import { NextResponse } from "next/server";
import { query, withTransaction, logAudit } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { signatureStatusSql } from "@/lib/schema";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["reviewer", "inspector", "legal"];
const json = (body, status = 200) => NextResponse.json(body, { status });

export async function GET(req) {
  try {
    if (!(await requireRole(req, STAFF_ROLES)))
      return json({ error: "Unauthorized" }, 401);
    const sigSql = await signatureStatusSql();
    const res = await query(
      `SELECT r.id, r.lat, r.lng, r.acc, r.ts, r.type, r.note, (r.photo_url IS NOT NULL AND r.photo_url <> '') AS "hasPhoto", r.hash, ${sigSql},
              r.source, r.location_source AS "locationSource", r.time_source AS "timeSource",
              r.device_public_key AS "publicKey",
              r.status, r.outcome, r.viewed_at AS "viewedAt", r.reviewed_by AS "reviewedBy",
              r.triage_category AS category, r.triaged_at AS "triagedAt", r.triaged_by AS "triagedBy",
              r.inspected_at AS "inspectedAt", r.inspected_by AS "inspectedBy", r.decided_at AS "decidedAt",
              (EXTRACT(EPOCH FROM r.received_at) * 1000)::double precision AS "receivedAt",
              COALESCE(i.claimed, false) AS claimed
       FROM reports r LEFT JOIN identity_vault i ON i.report_id = r.id
       ORDER BY r.received_at DESC LIMIT 500`,
    );
    return json(res.rows);
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}

// No POST here: the public send reports through the Kuuma Obutonde reporter app,
// which writes to the same database and runs the duplicate photo checks.

export async function DELETE(req) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEMO_RESET !== "true"
  )
    return json({ error: "Demo reset is disabled" }, 403);
  const staff = await requireRole(req, ["reviewer", "inspector"]);
  if (!staff) return json({ error: "Forbidden" }, 403);
  try {
    await withTransaction(async (run) => {
      await run(`DELETE FROM reports`);
      await logAudit(null, staff.email, "DEMO_RESET", null, run);
    });
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}
