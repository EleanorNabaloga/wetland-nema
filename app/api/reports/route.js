import { NextResponse } from "next/server";
import { query, withTransaction, logAudit } from "@/lib/db";
import { requireRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["reviewer", "inspector", "legal"];
const json = (body, status = 200) => NextResponse.json(body, { status });

export async function GET(req) {
  try {
    if (!(await requireRole(req, STAFF_ROLES)))
      return json({ error: "Unauthorized" }, 401);
    const res = await query(
      `SELECT r.id, r.lat, r.lng, r.acc, r.ts, r.type, r.note, r.photo_url AS photo, r.hash,
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

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat ?? 0);
    const lng = Number(body.lng ?? 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: "Location is required." }, 400);
    }

    const reportId = String(body.id || `NEMA-${Date.now()}`);
    const photo = String(body.photo || "");
    const payload = {
      id: reportId,
      lat,
      lng,
      acc: body.acc ?? null,
      ts: Number(body.ts ?? Date.now()),
      received_at: Number(body.received_at ?? body.ts ?? Date.now()),
      receivedAt: Number(
        body.receivedAt ?? body.received_at ?? body.ts ?? Date.now(),
      ),
      type: body.type || "Pollution",
      note: body.note || "",
      photo,
      photo_url: photo,
      hash: body.hash || null,
      source: body.source || "mobile",
      location_source: body.locationSource || body.location_source || "gps",
      locationSource: body.locationSource || body.location_source || "gps",
      time_source: body.timeSource || body.time_source || "device",
      timeSource: body.timeSource || body.time_source || "device",
      device_public_key: body.publicKey || body.device_public_key || null,
      publicKey: body.publicKey || body.device_public_key || null,
      status: body.status || "new",
      outcome: body.outcome || null,
      viewed_at: body.viewedAt || body.viewed_at || null,
      viewedAt: body.viewedAt || body.viewed_at || null,
      reviewed_by: body.reviewedBy || body.reviewed_by || null,
      reviewedBy: body.reviewedBy || body.reviewed_by || null,
      triage_category: body.category || body.triage_category || null,
      category: body.category || body.triage_category || null,
      triaged_at: body.triagedAt || body.triaged_at || null,
      triagedAt: body.triagedAt || body.triaged_at || null,
      triaged_by: body.triagedBy || body.triaged_by || null,
      triagedBy: body.triagedBy || body.triaged_by || null,
      inspected_at: body.inspectedAt || body.inspected_at || null,
      inspectedAt: body.inspectedAt || body.inspected_at || null,
      inspected_by: body.inspectedBy || body.inspected_by || null,
      inspectedBy: body.inspectedBy || body.inspected_by || null,
      decided_at: body.decidedAt || body.decided_at || null,
      decidedAt: body.decidedAt || body.decided_at || null,
      created_at: new Date().toISOString(),
    };

    const res = await query(
      `INSERT INTO reports (id, lat, lng, acc, ts, received_at, type, note, photo_url, hash, source, location_source, time_source, device_public_key, status, outcome, viewed_at, reviewed_by, triage_category, triaged_at, triaged_by, inspected_at, inspected_by, decided_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        payload.id,
        payload.lat,
        payload.lng,
        payload.acc,
        payload.ts,
        payload.received_at,
        payload.type,
        payload.note,
        payload.photo_url,
        payload.hash,
        payload.source,
        payload.location_source,
        payload.time_source,
        payload.device_public_key,
        payload.status,
        payload.outcome,
        payload.viewed_at,
        payload.reviewed_by,
        payload.triage_category,
        payload.triaged_at,
        payload.triaged_by,
        payload.inspected_at,
        payload.inspected_by,
        payload.decided_at,
      ],
    );

    await logAudit(reportId, "reporter", "REPORT_SUBMITTED", {
      type: payload.type,
      lat,
      lng,
    });
    return json({
      ok: true,
      id: reportId,
      row: res.rows[0] || { id: reportId },
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}

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
