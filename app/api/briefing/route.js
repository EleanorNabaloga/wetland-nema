import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { computeHotspots } from "@/lib/hotspots";
import { aiJoinSql } from "@/lib/schema";
import { getSystemSettings } from "@/lib/settings";
import { generateBriefing, draftReporterMessage } from "@/lib/briefing";

export const dynamic = "force-dynamic";

const ROLES = ["admin", "reviewer", "inspector", "legal", "oversight"];

export async function GET(req) {
  try {
    const user = await requireRole(req, ROLES);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ai = await aiJoinSql();
    const settings = await getSystemSettings().catch(() => null);

    const reportsRes = await query(
      `SELECT r.id, r.lat, r.lng, r.acc, r.ts, r.type, r.status,
              r.category, r.outcome, r.action_note AS "actionNote",
              r.inspected_at AS "inspectedAt", r.decided_at AS "decidedAt",
              r.device_public_key AS "publicKey",
              (EXTRACT(EPOCH FROM r.received_at) * 1000)::double precision AS "receivedAt"
              ${ai.select}
       FROM reports r
       ${ai.join}
       ORDER BY r.received_at DESC LIMIT 5000`,
    );

    const reports = reportsRes.rows.map((r) => ({
      ...r,
      lat: Number(r.lat),
      lng: Number(r.lng),
      acc: r.acc == null ? null : Number(r.acc),
      aiSeverity: r.aiSeverity || null,
    }));

    const hotspots = computeHotspots(reports);

    let pendingStaff = [];
    if (user.role === "admin") {
      const staffRes = await query(
        `SELECT email, name, role, status, created_at AS "createdAt"
         FROM staff_users
         WHERE status = 'pending'
         ORDER BY created_at ASC`,
      );
      pendingStaff = staffRes.rows;
    }

    let claims = [];
    try {
      const claimsRes = await query(
        `SELECT i.report_id AS "reportId", i.phone_fingerprint AS "fingerprint",
                i.claimed, (EXTRACT(EPOCH FROM i.claim_ts) * 1000)::double precision AS "claimTs",
                COALESCE(i.payout_held, false) AS "payoutHeld",
                i.payout_hold_reason AS "payoutHoldReason",
                r.device_public_key AS "publicKey",
                COALESCE(r.outcome = 'Marked false', false) AS "markedFalse"
         FROM identity_vault i
         LEFT JOIN reports r ON r.id = i.report_id
         WHERE i.claimed = true
         ORDER BY i.claim_ts DESC LIMIT 1000`,
      );
      claims = claimsRes.rows;
    } catch {
      claims = [];
    }

    const briefing = generateBriefing(reports, {
      hotspots,
      pendingStaff,
      claims,
      customSettings: settings,
    });

    const isOversight = user.role === "oversight";

    // Attach suggested drafts for urgent and nudge reports
    const attachDrafts = (items) =>
      items.map((item) => {
        const rep = item.report || item;
        const draftEn = draftReporterMessage(rep, "en");
        const draftLg = draftReporterMessage(rep, "lg");
        if (isOversight) {
          return {
            threatType: rep.type,
            severity: rep.aiSeverity || "Low",
            category: rep.category,
            status: rep.status,
            stage: item.sla?.stage || "acknowledge",
            overdue: item.sla?.overdue || false,
            draftMessageEn: draftEn,
            draftMessageLg: draftLg,
          };
        }
        return {
          ...item,
          draftMessageEn: draftEn,
          draftMessageLg: draftLg,
        };
      });

    return NextResponse.json({
      generatedAt: briefing.generatedAt,
      summary: briefing.summary,
      newUrgent: attachDrafts(briefing.newUrgent),
      deadlineNudges: attachDrafts(briefing.deadlineNudges),
      worsenedHotspots: briefing.worsenedHotspots.map((h) =>
        isOversight ? { ...h, ids: undefined } : h,
      ),
      pendingStaff: isOversight ? [] : pendingStaff,
      claimsWaitingFraudCheck: isOversight ? [] : briefing.claimsWaitingFraudCheck,
    });
  } catch (error) {
    console.error("[briefing] GET failed:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
