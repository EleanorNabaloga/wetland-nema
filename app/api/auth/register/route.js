import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { query, logAudit } from "@/lib/db";

const hits = new Map();
const json = (b, s = 200) => NextResponse.json(b, { status: s });

function tooMany(ip) {
  const a = hits.get(ip);
  if (!a || a.reset < Date.now()) {
    hits.set(ip, { count: 1, reset: Date.now() + 60 * 60 * 1000 });
    return false;
  }
  a.count += 1;
  return a.count > 5;
}

export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "local")
      .split(",")[0]
      .trim();
    if (tooMany(ip))
      return json({ error: "Too many requests. Try again later." }, 429);

    const b = await req.json().catch(() => null);
    if (!b) return json({ error: "Invalid request" }, 400);

    const name = String(b.name || "").trim();
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "");

    if (name.length < 2 || name.length > 80)
      return json({ error: "Enter your full name" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120)
      return json({ error: "Enter a valid email" }, 400);

    const domains = String(process.env.ALLOWED_EMAIL_DOMAIN || "nema.gov")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (!domains.includes(email.split("@")[1]))
      return json({ error: "Use your official NEMA email address" }, 400);

    if (password.length < 12 || password.length > 72)
      return json({ error: "Password must be 12 to 72 characters" }, 400);

    const ins = await query(
      `INSERT INTO staff_users (email, name, password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING email`,
      [email, name, bcrypt.hashSync(password, 10)],
    );
    if (ins.rowCount === 1)
      await logAudit(null, email, "STAFF_ACCESS_REQUESTED", { name });

    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}
