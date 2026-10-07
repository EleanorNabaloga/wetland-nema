import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // TODO: add the same auth/role check your reports API route uses
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
