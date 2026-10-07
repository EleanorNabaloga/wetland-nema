import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

function key() {
  const hex =
    process.env.MFA_ENCRYPTION_KEY ||
    "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
  if (!/^[0-9a-f]{64}$/i.test(hex))
    throw new Error("MFA_ENCRYPTION_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(text) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function decryptSecret(payload) {
  const [iv, tag, enc] = String(payload)
    .split(".")
    .map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
