import { readSession, COOKIE } from "@/lib/session";
import { query } from "@/lib/db";

export async function requireRole(req, roles) {
  const s = await readSession(req.cookies.get(COOKIE)?.value);
  if (!s) return null;
  const r = await query(`SELECT role FROM staff_users WHERE email = $1 AND status = 'active'`, [s.email]);
  const role = r.rows[0] && r.rows[0].role;
  return role && roles.includes(role) ? { email: s.email, role } : null;
}
