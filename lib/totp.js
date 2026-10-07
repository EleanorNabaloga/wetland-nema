import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newSecret() {
  let bits = "";
  for (const x of randomBytes(20)) bits += x.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

function b32decode(s) {
  let bits = "";
  for (const c of s.toUpperCase()) {
    const v = B32.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", b32decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}

// Returns the matched time step, or null. Steps at or below lastStep are refused (no reuse).
export function verifyTotp(secret, code, lastStep = 0) {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    const step = now + d;
    if (step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(c))) return step;
  }
  return null;
}

export const otpauthUrl = (email, secret) =>
  `otpauth://totp/${encodeURIComponent("NEMA Wetland Watch:" + email)}?secret=${secret}&issuer=${encodeURIComponent("NEMA Wetland Watch")}&algorithm=SHA1&digits=6&period=30`;
