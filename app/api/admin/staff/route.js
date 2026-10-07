import { NextResponse } from "next/server";
import { query, withTransaction, logAudit } from "@/lib/db";
import { requireRole } from "@/lib/guard";

export const dynamic = "force-dynamic";
const json = (b, s = 200) => NextResponse.json(b, { status: s });
const GRANTABLE = ["reviewer", "inspector", "legal", "oversight"];

export async function GET(req) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return json({ error: "Forbidden" }, 403);
  const res = await query(
    `SELECT email, name, role, status, created_at AS "createdAt", decided_by AS "decidedBy", decided_at AS "decidedAt"
     FROM staff_users ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 200`,
  );
  return json(res.rows);
}

export async function PATCH(req) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return json({ error: "Forbidden" }, 403);

    const b = await req.json().catch(() => ({}));
    const email = String(b.email || "").toLowerCase();
    const action = b.action;
    if (email === admin.email) return json({ error: "You cannot change your own account" }, 400);
    if (action === "approve" && !GRANTABLE.includes(b.role)) return json({ error: "Choose a role" }, 400);

    const result = await withTransaction(async (run) => {
      const cur = await run(`SELECT role, status FROM staff_users WHERE email = $1 FOR UPDATE`, [email]);
      if (!cur.rows.length) return { error: "Not found", code: 404 };
      const { role, status } = cur.rows[0];
      if (role === "admin") return { error: "Admin accounts are managed outside the app", code: 403 };

      let next;
      if (action === "approve" && (status === "pending" || status === "disabled")) next = { status: "active", role: b.role, log: "STAFF_APPROVED" };
      else if (action === "reject" && status === "pending") next = { status: "rejected", role, log: "STAFF_REJECTED" };
      else if (action === "disable" && status === "active") next = { status: "disabled", role, log: "STAFF_DISABLED" };
      else return { error: "That action is not allowed now", code: 409 };

      await run(`UPDATE staff_users SET status=$2, role=$3, decided_by=$4, decided_at=now() WHERE email=$1`, [email, next.status, next.role, admin.email]);
      await logAudit(null, admin.email, next.log, { target: email, role: next.role }, run);
      return { ok: true };
    });

    if (result.error) return json({ error: result.error }, result.code);
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}
