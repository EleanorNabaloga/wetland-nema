import { NextResponse } from "next/server";
import { query, getPool } from "@/lib/db";
import { ensureAiTables } from "@/lib/schema";
import { executeAiTriage } from "@/lib/ai/fallbackEngine";
import { getSystemSettings } from "@/lib/settings";
import { trackFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req) {
  return handleWorker(req);
}

export async function POST(req) {
  return handleWorker(req);
}

async function handleWorker(req) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json(
      { error: "CRON_SECRET must be configured in production" },
      { status: 500 },
    );
  }
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tablesReady = await ensureAiTables();
    if (!tablesReady) {
      return NextResponse.json({ processed: 0, status: "ai_tables_not_ready" });
    }

    // Self-healing queue backfill: enqueue any reports that arrived before queue creation
    await query(
      `INSERT INTO ai_triage_queue (report_id, status)
       SELECT r.id, 'pending'
       FROM reports r
       WHERE r.id NOT IN (SELECT report_id FROM ai_triage_queue)
       ON CONFLICT (report_id) DO NOTHING`,
    ).catch(() => {});

    // Two-phase short-lived lease with non-blocking concurrency:
    // Claim up to 10 jobs using CTE + FOR UPDATE SKIP LOCKED
    const fetchRes = await query(
      `WITH to_process AS (
         SELECT id FROM ai_triage_queue
         WHERE (status = 'pending' OR (status = 'processing' AND locked_at < now() - INTERVAL '5 minutes'))
           AND attempts < max_attempts
         ORDER BY created_at ASC
         LIMIT 10
         FOR UPDATE SKIP LOCKED
       )
       UPDATE ai_triage_queue q
       SET status = 'processing',
           attempts = q.attempts + 1,
           locked_at = now(),
           updated_at = now()
       FROM to_process
       WHERE q.id = to_process.id
       RETURNING q.id, q.report_id AS "reportId", q.attempts`,
    );

    const jobs = fetchRes.rows || [];
    let processedCount = 0;
    const settings = await getSystemSettings().catch(() => null);

    for (const job of jobs) {
      try {
        const reportRes = await query(
          `SELECT id, lat, lng, acc, ts, type, note, photo_url AS photo
           FROM reports WHERE id = $1`,
          [job.reportId],
        );
        const report = reportRes.rows?.[0];
        if (!report) {
          await query(
            `UPDATE ai_triage_queue SET status = 'failed', last_error = 'Report not found' WHERE id = $1`,
            [job.id],
          );
          continue;
        }

        const assessment = await executeAiTriage(report, settings);

        await query(
          `INSERT INTO ai_assessments (
             report_id, model_id, prompt_version, severity, suggested_category,
             suggested_outcome, confidence, urgency_score, key_evidence_tags,
             reason, tier_executed, is_latest
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true
           )
           ON CONFLICT (report_id) WHERE is_latest = true DO UPDATE SET
             severity = EXCLUDED.severity,
             suggested_category = EXCLUDED.suggested_category,
             suggested_outcome = EXCLUDED.suggested_outcome,
             confidence = EXCLUDED.confidence,
             urgency_score = EXCLUDED.urgency_score,
             key_evidence_tags = EXCLUDED.key_evidence_tags,
             reason = EXCLUDED.reason,
             tier_executed = EXCLUDED.tier_executed,
             model_id = EXCLUDED.model_id,
             prompt_version = EXCLUDED.prompt_version`,
          [
            report.id,
            "fallback-engine-v1",
            "v1.0.0",
            assessment.category === "Emergency"
              ? "Critical"
              : assessment.category === "Enforcement"
                ? "High"
                : assessment.category === "Referral"
                  ? "Medium"
                  : "Low",
            assessment.category,
            assessment.category === "Emergency" || assessment.category === "Enforcement"
              ? "Inspector will visit"
              : assessment.category === "Referral"
                ? "Referred to another agency"
                : "Need more information",
            assessment.confidence,
            assessment.urgency,
            Array.isArray(assessment.tags) ? assessment.tags : ["local_cpu_model"],
            assessment.summary || assessment.reason || "Priority assessment completed.",
            assessment.tier,
          ],
        );

        await query(
          `UPDATE ai_triage_queue
           SET status = 'completed',
               tier_executed = $2,
               locked_at = NULL,
               updated_at = now()
           WHERE id = $1`,
          [job.id, assessment.tier],
        );

        processedCount++;
      } catch (jobErr) {
        trackFailure({
          component: "cron_ai_worker",
          action: "process_job",
          id: job.reportId,
          error: jobErr,
        });

        await query(
          `UPDATE ai_triage_queue
           SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
               last_error = $2,
               locked_at = NULL,
               updated_at = now()
           WHERE id = $1`,
          [job.id, String(jobErr.message || jobErr).slice(0, 200)],
        ).catch(() => {});
      }
    }

    return NextResponse.json({ processed: processedCount, totalLeased: jobs.length });
  } catch (err) {
    trackFailure({
      component: "cron_ai_worker",
      action: "batch_execution",
      error: err,
    });
    return NextResponse.json({ error: "Worker error" }, { status: 500 });
  }
}
