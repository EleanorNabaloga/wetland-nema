import { query } from "@/lib/db";

// The reporter app adds reports.signature / signature_status when it stores its
// first signed report. The dashboard reads signature_status, so it makes sure
// the columns exist too (same statement, safe to run any number of times).
// If the database refuses, the dashboard still works and shows no status.
let ready;
export function ensureSignatureColumns() {
  if (!ready) {
    ready = Promise.resolve(
      query(
        `ALTER TABLE reports
           ADD COLUMN IF NOT EXISTS signature text,
           ADD COLUMN IF NOT EXISTS signature_status text`,
      ),
    )
      .then(() => true)
      .catch((error) => {
        console.error("Could not add evidence-signature columns:", error.message);
        ready = undefined;
        return false;
      });
  }
  return ready;
}

/** SQL for the signature status column, or NULL when it is unavailable. */
export async function signatureStatusSql() {
  return (await ensureSignatureColumns())
    ? `r.signature_status AS "signatureStatus"`
    : `NULL AS "signatureStatus"`;
}
