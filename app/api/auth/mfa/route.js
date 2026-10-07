import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { query, logAudit } from "@/lib/db";
import { readPreAuth, createSession, PRE_COOKIE, COOKIE } from "@/lib/session";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { newSecret, verifyTotp, otpauthUrl } from "@/lib/totp";

export const dynamic = "force-dynamic";
const json = (b, s = 200) => NextResponse.json(b, { status: s });

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();
const blocked = (k) => {
  const a = fails.get(k);
  if (!a) return false;
  if (a.reset < Date.now()) { fails.delete(k); return false; }
  return a.count >= MAX_FAILS;
};
const recordFail = (k) => {
  const a = fails.get(k);
  if (!a || a.reset < Date.now()) fails.set(k, { count: 1, reset: Date.now() + WINDOW_MS });
  else a.count += 1;
};

async function who(req) {
  const pre = await readPreAuth(req.cookies.get(PRE_COOKIE)?.value);
  if (!pre) return null;
  const r = await query(
    `SELECT email, role, status, totp_secret, totp_enabled, totp_last_step FROM staff_users WHERE email = $1`,
    [pre.email],
  );
  const u = r.rows[0];
  return u && u.status === "active" ? u : null;
}

export async function GET(req) {
  try {
    const u = await who(req);
    if (!u) return json({ error: "Sign in again" }, 401);
    if (u.totp_enabled) return json({ mode: "verify" });

    await query(
      `UPDATE staff_users SET totp_secret = $2 WHERE email = $1 AND totp_enabled = false AND totp_secret IS NULL`,
      [u.email, encryptSecret(newSecret())],
    );
    const cur = await query(`SELECT totp_secret FROM staff_users WHERE email = $1`, [u.email]);
    const secret = decryptSecret(cur.rows[0].totp_secret);
    const qr = await QRCode.toDataURL(otpauthUrl(u.email, secret), { margin: 1, width: 220 });
    return json({ mode: "setup", qr, secret });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}

export async function POST(req) {
  try {
    const u = await who(req);
    if (!u) return json({ error: "Sign in again" }, 401);

    const key = "mfa:" + u.email;
    if (blocked(key)) return json({ error: "Too many attempts. Wait 15 minutes." }, 429);

    const b = await req.json().catch(() => ({}));
    if (!u.totp_secret) return json({ error: "Start setup first" }, 409);

    const step = verifyTotp(decryptSecret(u.totp_secret), b.code, Number(u.totp_last_step));
    if (step === null) {
      recordFail(key);
      return json({ error: "Invalid code" }, 401);
    }

    const upd = await query(
      `UPDATE staff_users SET totp_enabled = true, totp_last_step = $2 WHERE email = $1 AND totp_last_step < $2`,
      [u.email, step],
    );
    if (upd.rowCount === 0) return json({ error: "That code was already used. Wait for the next one." }, 409);

    fails.delete(key);
    await logAudit(null, u.email, u.totp_enabled ? "STAFF_LOGIN" : "MFA_ENROLLED");

    const res = json({ ok: true, role: u.role });
    res.cookies.set(COOKIE, await createSession(u), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    res.cookies.set(PRE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
}
