import { NextResponse } from "next/server";
import { query, withTransaction, logAudit } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { distanceM } from "@/lib/geo";
import { ensureAiTables } from "@/lib/schema";
import { NEEDS_INSPECTION } from "@/lib/sla";
import { trackBlockedAction } from "@/lib/observability";

export const dynamic = "force-dynamic";

const VALID_CLARITY = ["clear", "murky_clay", "chemical_opaque", "oil_sheen"];
const VALID_ODOR = ["natural_earth", "raw_sewage", "chemical_solvent", "burning", "none"];
const VALID_ACTION = [
  "restoration_order",
  "stop_notice",
  "environmental_police_escort",
  "no_violation_natural_runoff",
  "refer_to_local_council",
];

const json = (body, status = 200) => NextResponse.json(body, { status });

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const staff = await requireRole(req, ["reviewer", "inspector", "legal", "admin"]);
    if (!staff) return json({ error: "Unauthorized" }, 401);

    await ensureAiTables().catch(() => {});
    const res = await query(
      `SELECT id, report_id AS "reportId", ranger_email AS "rangerEmail",
              certificate_number AS "certificateNumber", lat, lng,
              distance_m AS "distanceM", photo_url AS "photoUrl",
              water_ph AS "waterPh", water_clarity AS "waterClarity",
              odor, findings_summary AS "findingsSummary",
              action_recommended AS "actionRecommended",
              forced, force_reason AS "forceReason",
              created_at AS "createdAt"
       FROM field_inspections
       WHERE report_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id],
    );

    return json({ inspection: res.rows[0] || null });
  } catch (error) {
    console.error("Failed to fetch inspection:", error);
    return json({ error: "Server error" }, 500);
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const staff = await requireRole(req, ["inspector", "admin"]);
    if (!staff) return json({ error: "Forbidden" }, 403);

    const b = await req.json().catch(() => ({}));
    const isForceRequested = Boolean(b.force);
    const forceReason = typeof b.forceReason === "string" ? b.forceReason.trim() : (typeof b.force_reason === "string" ? b.force_reason.trim() : "");

    if (staff.role === "inspector") {
      if (isForceRequested) {
        trackBlockedAction("field_inspection", "inspector_force_forbidden", {
          id,
          user: staff.email,
        });
        return json({ error: "Inspectors cannot force inspections. Administrative override is required." }, 403);
      }
    } else if (staff.role === "admin") {
      if (!isForceRequested) {
        trackBlockedAction("field_inspection", "admin_direct_inspection_forbidden", {
          id,
          user: staff.email,
        });
        return json({ error: "Only field inspectors can record standard inspections. Administrative access is restricted to forced overrides with reason." }, 403);
      }
      if (forceReason.length < 10) {
        trackBlockedAction("field_inspection", "missing_or_short_force_reason", {
          id,
          user: staff.email,
        });
        return json({ error: "A written forceReason of at least 10 characters is required for administrative overrides" }, 400);
      }
    } else {
      return json({ error: "Forbidden" }, 403);
    }

    const isForced = staff.role === "admin" && isForceRequested;
    const rawLat = b.lat;
    const rawLng = b.lng;
    const lat = rawLat == null || rawLat === "" ? NaN : Number(rawLat);
    const lng = rawLng == null || rawLng === "" ? NaN : Number(rawLng);
    const certNumber = String(b.certificateNumber || b.certificate_number || "").trim().slice(0, 120);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json({ error: "Valid on-site GPS coordinates (lat, lng) are required" }, 400);
    }
    if (!certNumber) {
      return json({ error: "Section 107 Inspection Certificate Number is required" }, 400);
    }

    const rawPh = b.waterPh != null ? Number(b.waterPh) : (b.water_ph != null ? Number(b.water_ph) : null);
    if (rawPh != null && (!Number.isFinite(rawPh) || rawPh < 0 || rawPh > 14)) {
      return json({ error: "Water pH must be a number between 0.0 and 14.0" }, 400);
    }
    const waterPh = rawPh != null ? Math.round(rawPh * 10) / 10 : null;

    const clarity = b.waterClarity || b.water_clarity || null;
    if (clarity && !VALID_CLARITY.includes(clarity)) {
      return json({ error: `Invalid water clarity. Allowed: ${VALID_CLARITY.join(", ")}` }, 400);
    }

    const odor = b.odor || null;
    if (odor && !VALID_ODOR.includes(odor)) {
      return json({ error: `Invalid odor. Allowed: ${VALID_ODOR.join(", ")}` }, 400);
    }

    const action = b.actionRecommended || b.action_recommended || null;
    if (action && !VALID_ACTION.includes(action)) {
      return json({ error: `Invalid action recommended. Allowed: ${VALID_ACTION.join(", ")}` }, 400);
    }

    const gpsAcc = b.acc != null && Number.isFinite(Number(b.acc)) ? Math.max(0, Number(b.acc)) : 0;
    const maxAllowedDist = Math.min(300, 200 + gpsAcc);

    const inspectionId = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rawPhotoUrl = b.photoUrl || b.photo_url || null;
    const photoUrl = typeof rawPhotoUrl === "string" ? rawPhotoUrl.trim().slice(0, 2048) || null : null;
    const rawSummary = b.findingsSummary || b.findings_summary || null;
    const summary = typeof rawSummary === "string" ? rawSummary.trim().slice(0, 2000) || null : null;

    await ensureAiTables().catch(() => {});

    const txResult = await withTransaction(async (run) => {
      // Lock report row to prevent concurrent status/category races
      const repRes = await run(
        `SELECT id, lat, lng, triage_category AS category, status, inspected_at FROM reports r WHERE r.id = $1 FOR UPDATE`,
        [id],
      );
      if (repRes.rows.length === 0) {
        return { errorBody: { error: "Report not found" }, status: 404 };
      }

      const report = repRes.rows[0];
      const category = report.category || "Referral";

      if (!NEEDS_INSPECTION.includes(category) && !isForced) {
        trackBlockedAction("field_inspection", "not_applicable_category", {
          id,
          reason: category,
          user: staff.role,
        });
        return {
          errorBody: { error: "Section 107 physical inspection applies to Emergency and Enforcement categories" },
          status: 409,
        };
      }

      const repLat = report.lat == null ? NaN : Number(report.lat);
      const repLng = report.lng == null ? NaN : Number(report.lng);
      if (!Number.isFinite(repLat) || !Number.isFinite(repLng)) {
        return {
          errorBody: { error: "Report coordinates are missing or invalid" },
          status: 422,
        };
      }

      // Verify GPS distance: ranger must be within radius (200m base + accuracy buffer up to 300m)
      const dist = distanceM(
        { lat: repLat, lng: repLng },
        { lat, lng },
      );

      if ((!Number.isFinite(dist) || dist > maxAllowedDist) && !isForced) {
        trackBlockedAction("field_inspection", "gps_distance_exceeded", {
          id,
          reason: `${Math.round(dist)}m_limit_${Math.round(maxAllowedDist)}m`,
          user: staff.role,
        });
        return {
          errorBody: {
            error: `Ranger GPS fix (${Math.round(dist)}m away) exceeds maximum allowable ${Math.round(maxAllowedDist)}m radius from reported wetland spot`,
            distanceM: Math.round(dist),
            maxDistanceM: Math.round(maxAllowedDist),
          },
          status: 422,
        };
      }

      await run(
        `INSERT INTO field_inspections (
          id, report_id, ranger_email, certificate_number,
          lat, lng, distance_m, photo_url,
          water_ph, water_clarity, odor,
          findings_summary, action_recommended, forced, force_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())`,
        [
          inspectionId,
          id,
          staff.email,
          certNumber,
          lat,
          lng,
          Math.round(dist * 10) / 10,
          photoUrl,
          waterPh,
          clarity,
          odor,
          summary,
          action,
          isForced,
          isForced ? forceReason : null,
        ],
      );

      await run(
        `UPDATE reports SET inspected_at = COALESCE(inspected_at, now()), inspected_by = COALESCE(inspected_by, $2) WHERE id = $1`,
        [id, staff.email],
      );

      await logAudit(
        id,
        staff.email,
        "RECORDED_SECTION_107_INSPECTION",
        {
          inspectionId,
          certificateNumber: certNumber,
          distanceM: Math.round(dist),
          waterPh,
          actionRecommended: action,
          forced: isForced,
          forceReason: isForced ? forceReason : null,
          forcedBy: isForced ? staff.email : null,
        },
        run,
      );

      return { body: { ok: true, inspectionId, distanceM: Math.round(dist), forced: isForced }, status: 201 };
    });

    if (txResult.errorBody) {
      return json(txResult.errorBody, txResult.status);
    }
    return json(txResult.body, txResult.status);
  } catch (error) {
    console.error("Failed to record inspection:", error);
    return json({ error: "Server error" }, 500);
  }
}
