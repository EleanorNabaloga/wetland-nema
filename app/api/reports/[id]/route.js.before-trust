import { NextResponse } from "next/server";
import { query, withTransaction, logAudit } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { CATEGORIES, NEEDS_INSPECTION } from "@/lib/sla";

export const dynamic = "force-dynamic";

const OUTCOMES = ["Inspector will visit", "Referred to another agency", "Need more information"];
const json = (body, status = 200) => NextResponse.json(body, { status });

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const staff = await requireRole(req, ["reviewer", "inspector", "legal"]);
    if (!staff) return json({ error: "Unauthorized" }, 401);

    const res = await query(
      `SELECT r.id, r.lat, r.lng, r.acc, r.ts, r.type, r.note, r.photo_url AS photo, r.hash,
              r.status, r.outcome, r.viewed_at AS "viewedAt", r.reviewed_by AS "reviewedBy",
              r.triage_category AS category, r.triaged_at AS "triagedAt", r.inspected_at AS "inspectedAt",
              r.decided_at AS "decidedAt", (EXTRACT(EPOCH FROM r.received_at) * 1000)::double precision AS "receivedAt",
              COALESCE(i.claimed, false) AS claimed
       FROM reports r LEFT JOIN identity_vault i ON r.id = i.report_id WHERE r.id = $1`,
      [id],
    );
    if (res.rows.length === 0) return json({ error: "Not found" }, 404);
    await logAudit(id, staff.email, "OPENED_REPORT");
    return json(res.rows[0]);
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const staff = await requireRole(req, ["reviewer", "inspector"]);
    if (!staff) return json({ error: "Forbidden" }, 403);

    const outcomeGiven = b.outcome !== undefined;
    const categoryGiven = b.category !== undefined;
    if (outcomeGiven && b.outcome !== "" && !OUTCOMES.includes(b.outcome)) return json({ error: "Invalid outcome" }, 400);
    if (categoryGiven && !CATEGORIES.includes(b.category)) return json({ error: "Invalid category" }, 400);

    const result = await withTransaction(async (run) => {
      const cur = await run(
        `SELECT status, outcome, triage_category, inspected_at, decided_at FROM reports WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.rows.length === 0) return { error: "Not found", code: 404 };
      const row = cur.rows[0];

      const willReview = b.view === true && row.status === "new";
      const reviewed = row.status === "viewed" || willReview;
      if ((outcomeGiven || categoryGiven || b.inspected === true) && !reviewed) return { error: "Review the report first", code: 409 };

      if (willReview) {
        await run(`UPDATE reports SET status = 'viewed', viewed_at = now(), reviewed_by = $2 WHERE id = $1`, [id, staff.email]);
        await logAudit(id, staff.email, "VIEWED_REPORT", null, run);
      }

      let category = row.triage_category;
      if (categoryGiven && b.category !== category) {
        await run(
          `UPDATE reports SET triage_category = $2, triaged_at = COALESCE(triaged_at, now()), triaged_by = $3 WHERE id = $1`,
          [id, b.category, staff.email],
        );
        await logAudit(id, staff.email, "TRIAGED", { from: category, to: b.category }, run);
        category = b.category;
      }

      if (b.inspected === true && !row.inspected_at) {
        if (!NEEDS_INSPECTION.includes(category)) return { error: "Inspection applies to Emergency and Enforcement only", code: 409 };
        await run(`UPDATE reports SET inspected_at = now(), inspected_by = $2 WHERE id = $1`, [id, staff.email]);
        await logAudit(id, staff.email, "INSPECTED", null, run);
      }

      if (outcomeGiven) {
        const next = b.outcome === "" ? null : b.outcome;
        if (next !== row.outcome) {
          await run(
            `UPDATE reports SET outcome = $2, decided_at = CASE WHEN $2::text IS NULL THEN NULL ELSE COALESCE(decided_at, now()) END WHERE id = $1`,
            [id, next],
          );
          await logAudit(id, staff.email, "UPDATED_OUTCOME", { from: row.outcome, to: next }, run);
        }
      }
      return { ok: true };
    });

    if (result.error) return json({ error: result.error }, result.code);
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}
