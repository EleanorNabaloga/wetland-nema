import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  createPreAuth,
  createSession,
  PRE_COOKIE,
  COOKIE,
} from "@/lib/session";
import { query } from "@/lib/db";

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();
const DUMMY = bcrypt.hashSync("not-a-real-password", 10);

function blocked(key) {
  const a = fails.get(key);
  if (!a) return false;
  if (a.reset < Date.now()) {
    fails.delete(key);
    return false;
  }
  return a.count >= MAX_FAILS;
}
function recordFail(key) {
  const a = fails.get(key);
  if (!a || a.reset < Date.now())
    fails.set(key, { count: 1, reset: Date.now() + WINDOW_MS });
  else a.count += 1;
}

function needsMfa(role) {
  const mode = process.env.MFA_MODE || "off";
  if (mode === "off") return false;
  if (mode === "admin") return role === "admin";
  return true;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const ip = (req.headers.get("x-forwarded-for") || "local")
    .split(",")[0]
    .trim();
  const keys = ["ip:" + ip, "email:" + email];

  if (keys.some(blocked))
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const r = await query(
    `SELECT email, password_hash, role, status, totp_enabled FROM staff_users WHERE email = $1`,
    [email],
  );
  const u = r.rows[0];
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY);

  if (!u || !ok) {
    keys.forEach(recordFail);
    return NextResponse.json({ error: "Invalid login" }, { status: 401 });
  }
  if (u.status !== "active") {
    return NextResponse.json(
      { error: "Account not active", status: u.status },
      { status: 403 },
    );
  }

  keys.forEach((k) => fails.delete(k));
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };

  if (!needsMfa(u.role)) {
    const res = NextResponse.json({ ok: true, mfa: "none", role: u.role });
    res.cookies.set(
      COOKIE,
      await createSession({ email: u.email, role: u.role }),
      { ...cookie, maxAge: 60 * 60 * 8 },
    );
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    mfa: u.totp_enabled ? "verify" : "setup",
  });
  res.cookies.set(PRE_COOKIE, await createPreAuth(u.email), {
    ...cookie,
    maxAge: 600,
  });
  return res;
}
