// Duplicate photo check that still works after a photo is resized,
// compressed, re-saved, screenshotted or rotated.
//
// Each photo gets a 64-bit "perceptual hash": shrink it to 32x32 grey pixels,
// keep only the coarse light-and-dark pattern (the lowest 8x8 frequencies of a
// DCT), and record which parts are above the middle value. Resizing, compression,
// re-saving and brightness changes barely touch that pattern, so the same picture
// gives nearly the same fingerprint. Few differing bits means the same photo.
//
// The server works the fingerprint out itself, so a phone cannot fake it.
// Uses PostgreSQL when the app does, and a local JSON file in demo mode.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getPool } from "@/lib/db";

// Bits (out of 64) that may differ and still count as the same photo.
// Tested on 14 photos: resized, recompressed, re-saved, rotated, brightened and
// stretched copies differed by 0-4; different photos by 14 or more (a recoloured
// copy of the same picture by 2-4, which counts as a duplicate). A 5% crop
// differed by 4-16, so small crops are caught only some of the time.
export const MAX_DISTANCE = 10;

const jsonMode = () =>
  process.env.USE_LOCAL_DEMO_FALLBACK === "true" || !process.env.DATABASE_URL;

// "data:image/jpeg;base64,...." -> Buffer, or null if it is not an image.
export function decodeDataUrl(photo) {
  const m = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(String(photo || ""));
  return m ? Buffer.from(m[1], "base64") : null;
}

const N = 32;
const COS = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))),
);

async function pHash(image) {
  const { data } = await image
    .greyscale()
    .resize(N, N, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const coeffs = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) sum += data[y * N + x] * COS[u][x] * COS[v][y];
      }
      coeffs.push(sum);
    }
  }
  // Middle value, ignoring the first one (overall brightness).
  const median = coeffs.slice(1).sort((a, b) => a - b)[31];
  let bits = 0n;
  for (const c of coeffs) bits = (bits << 1n) | (c > median ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

// Fingerprints of the photo as taken and turned 90, 180 and 270 degrees,
// so a rotated copy is caught too. The first one is the photo as taken.
export async function fingerprintsOf(buffer) {
  const base = sharp(buffer, { failOn: "error" }).rotate(); // follow the camera's orientation tag
  const upright = await base.clone().toBuffer();
  return Promise.all([0, 90, 180, 270].map((deg) => pHash(sharp(upright).rotate(deg))));
}

export function distance(a, b) {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/* ---------- storage ---------- */
const JSON_FILE = path.join(process.cwd(), "data", "photo_fingerprints.json");
function readJson() {
  try {
    return JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  } catch {
    return [];
  }
}

let ready;
function ensureTable() {
  if (!ready) {
    ready = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS photo_fingerprints (
           report_id text PRIMARY KEY,
           phash text NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now()
         )`,
      )
      .catch((e) => {
        ready = undefined;
        throw e;
      });
  }
  return ready;
}

async function allFingerprints() {
  if (jsonMode()) return readJson();
  await ensureTable();
  const res = await getPool().query("SELECT report_id, phash FROM photo_fingerprints");
  return res.rows;
}

// The closest earlier photo within MAX_DISTANCE, or null.
export async function findDuplicate(hashes) {
  let best = null;
  for (const row of await allFingerprints()) {
    for (const h of hashes) {
      const d = distance(h, row.phash);
      if (d <= MAX_DISTANCE && (!best || d < best.distance)) {
        best = { reportId: row.report_id, distance: d };
      }
    }
  }
  return best;
}

export async function saveFingerprint(reportId, phash) {
  if (jsonMode()) {
    const rows = readJson();
    rows.push({ report_id: reportId, phash, created_at: new Date().toISOString() });
    fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true });
    fs.writeFileSync(JSON_FILE, JSON.stringify(rows, null, 2));
    return;
  }
  await ensureTable();
  await getPool().query(
    "INSERT INTO photo_fingerprints (report_id, phash) VALUES ($1, $2) ON CONFLICT (report_id) DO NOTHING",
    [reportId, phash],
  );
}
