import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { computeHotspots, reporterOf } from "@/lib/hotspots";

export const dynamic = "force-dynamic";

// Report staff see report ids in each hotspot. Oversight sees totals only:
// no ids, photos, notes or exact report locations.
const STAFF_ROLES = ["reviewer", "inspector", "legal"];
const ROLES = [...STAFF_ROLES, "oversight"];

export async function GET(req) {
  try {
    const user = await requireRole(req, ROLES);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const res = await query(
      `SELECT r.id, r.lat, r.lng, r.acc, r.ts, r.type, r.status,
              r.device_public_key AS "publicKey",
              (EXTRACT(EPOCH FROM r.received_at) * 1000)::double precision AS "receivedAt"
       FROM reports r ORDER BY r.received_at DESC LIMIT 5000`,
    );
    const reports = res.rows.map((r) => ({
      ...r,
      lat: Number(r.lat),
      lng: Number(r.lng),
      acc: r.acc == null ? null : Number(r.acc),
    }));

    const canOpenReports = STAFF_ROLES.includes(user.role);
    const hotspots = computeHotspots(reports).map((h) =>
      canOpenReports ? h : { ...h, ids: undefined },
    );
    return NextResponse.json({
      hotspots,
      reporterKnown: reports.some((r) => reporterOf(r) != null),
      canOpenReports,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
