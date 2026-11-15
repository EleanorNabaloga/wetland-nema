import { NextResponse } from "next/server";
import { query, logAudit, withTransaction } from "@/lib/db";
import { requireRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

const json = (b, s = 200) => NextResponse.json(b, { status: s });
const AUTHORIZED_ROLES = ["admin", "reviewer", "legal"];

export async function GET(req) {
  try {
    const user = await requireRole(req, AUTHORIZED_ROLES);
    if (!user) return json({ error: "Forbidden" }, 403);

    const res = await query(
      `SELECT i.report_id AS "reportId", i.phone_fingerprint AS "fingerprint",
              i.claimed, (EXTRACT(EPOCH FROM i.claim_ts) * 1000)::double precision AS "claimTs",
              COALESCE(i.payout_held, false) AS "payoutHeld",
              i.payout_hold_reason AS "payoutHoldReason",
              r.type AS "threatType", r.status,
              r.device_public_key AS "publicKey"
       FROM identity_vault i
       LEFT JOIN reports r ON r.id = i.report_id
       WHERE i.payout_held = true
       ORDER BY i.claim_ts DESC LIMIT 200`,
    );

    return json(
      res.rows.map((row) => ({
        reportId: row.reportId,
        fingerprintPrefix: row.fingerprint ? `${row.fingerprint.slice(0, 8)}...` : "N/A",
        devicePrefix: row.publicKey ? `${row.publicKey.slice(0, 8)}...` : "N/A",
        threatType: row.threatType,
        status: row.status,
        claimTs: row.claimTs,
        payoutHeld: row.payoutHeld,
        reason: row.payoutHoldReason,
      })),
    );
  } catch (error) {
    console.error("[payouts] GET failed:", error);
    return json({ error: "Server error" }, 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await requireRole(req, AUTHORIZED_ROLES);
    if (!user) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { reportId, action, reason } = body;

    if (!reportId || !action) {
      return json({ error: "reportId and action are required" }, 400);
    }

    if (!["release", "refuse"].includes(action)) {
      return json({ error: "action must be release or refuse" }, 400);
    }

    const result = await withTransaction(async (run) => {
      const cur = await run(
        `SELECT report_id, payout_held FROM identity_vault WHERE report_id = $1 FOR UPDATE`,
        [reportId],
      );
      if (!cur.rows.length) return { error: "Claim not found", code: 404 };

      if (action === "release") {
        await run(
          `UPDATE identity_vault SET payout_held = false, payout_hold_reason = NULL WHERE report_id = $1`,
          [reportId],
        );
        await logAudit(reportId, user.email, "PAYOUT_RELEASED", { reason: reason || "Manager release" }, run);
      } else {
        await run(
          `UPDATE identity_vault SET payout_held = true, payout_hold_reason = $2 WHERE report_id = $1`,
          [reportId, reason || "Refused by manager"],
        );
        await logAudit(reportId, user.email, "PAYOUT_REFUSED", { reason: reason || "Manager refusal" }, run);
      }

      return { ok: true };
    });

    if (result.error) return json({ error: result.error }, result.code);
    return json({ ok: true });
  } catch (error) {
    console.error("[payouts] PATCH failed:", error);
    return json({ error: "Server error" }, 500);
  }
}
