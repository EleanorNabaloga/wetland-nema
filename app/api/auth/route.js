import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, COOKIE } from "@/lib/session";

export async function POST(req) {
  const { email, password } = await req.json();
  const users = JSON.parse(process.env.STAFF_USERS || "[]");
  const u = users.find((x) => x.email === String(email || "").toLowerCase());
  const ok = u ? await bcrypt.compare(String(password || ""), u.hash) : false;
  if (!ok)
    return NextResponse.json({ error: "Invalid login" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSession(u), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
