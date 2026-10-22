import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db";
import { requireRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Same staff roles as GET /api/reports. Report locations are not public.
const STAFF_ROLES = ["reviewer", "inspector", "legal"];

export async function GET(req) {
  if (!(await requireRole(req, STAFF_ROLES)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rows } = await getPool().query(`
    SELECT
      round(avg(lat)::numeric, 5)::float8            AS lat,
      round(avg(lng)::numeric, 5)::float8            AS lng,
      count(*)::int                          AS count,
      (count(*) FILTER (WHERE status = 'new'))::int AS open,
      max(ts)                                AS latest,
      array_agg(id)                          AS ids
    FROM reports
    WHERE acc <= 500
    GROUP BY round(lat / 0.005), round(lng / 0.005)
    HAVING count(*) >= 2
    ORDER BY count(*) DESC
    LIMIT 20
  `);
  return NextResponse.json({ hotspots: rows });
}
