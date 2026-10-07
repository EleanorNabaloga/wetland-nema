import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "ww_staff";
export const PRE_COOKIE = "ww_pre";

const secret = () =>
  new TextEncoder().encode(
    process.env.SESSION_SECRET || "wetland-watch-dev-secret-change-me",
  );

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
