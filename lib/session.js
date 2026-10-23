import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "ww_staff";
export const PRE_COOKIE = "ww_pre";

// In production a real SESSION_SECRET (32+ characters) is required: a key
// written in the code would let anyone forge a staff login. Development and
// tests may use the fallback.
const DEV_SECRET = "kuuma-obutonde-dev-secret-change-me";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32)) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  return new TextEncoder().encode(value || DEV_SECRET);
}

function sign(claims, sub, exp) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret());
}

async function read(token, typ) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.typ === typ ? payload : null;
  } catch {
    return null;
  }
}

export const createSession = (user) =>
  sign({ role: user.role, typ: "session" }, user.email, "8h");
export async function readSession(token) {
  const p = await read(token, "session");
  return p ? { email: p.sub, role: p.role } : null;
}

export const createPreAuth = (email) => sign({ typ: "pre" }, email, "10m");
export async function readPreAuth(token) {
  const p = await read(token, "pre");
  return p ? { email: p.sub } : null;
}
