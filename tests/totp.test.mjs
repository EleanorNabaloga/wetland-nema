import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { newSecret, verifyTotp, otpauthUrl } from "../lib/totp.js";

// RFC 6238 test secret "12345678901234567890" in base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// The code an authenticator app would show right now, written independently.
function codeNow(secretAscii, offsetSteps = 0) {
  const step = Math.floor(Date.now() / 30000) + offsetSteps;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", Buffer.from(secretAscii)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return { code: String(n % 1000000).padStart(6, "0"), step };
}

test("new secrets are 32 base32 characters (160 bits)", () => {
  const s = newSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.notEqual(s, newSecret());
});

test("accepts the current code and returns its time step", () => {
  const { code, step } = codeNow("12345678901234567890");
  assert.equal(verifyTotp(RFC_SECRET, code), step);
});

test("accepts a code one step early or late (clock drift)", () => {
  const { code } = codeNow("12345678901234567890", -1);
  assert.notEqual(verifyTotp(RFC_SECRET, code), null);
});

test("refuses a code that was already used", () => {
  const { code, step } = codeNow("12345678901234567890");
  assert.equal(verifyTotp(RFC_SECRET, code, step), null);
});

test("refuses wrong or badly formed codes", () => {
  assert.equal(verifyTotp(RFC_SECRET, "abcdef"), null);
  assert.equal(verifyTotp(RFC_SECRET, "12345"), null);
  assert.equal(verifyTotp(RFC_SECRET, ""), null);
});

test("the setup link names the app and the officer", () => {
  const url = otpauthUrl("jane@nema.gov", RFC_SECRET);
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.match(url, /jane%40nema\.gov/);
  assert.match(url, /issuer=NEMA%20Kuuma%20Obutonde/);
});
