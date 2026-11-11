import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHotspots, weightOf } from "../lib/hotspots.js";

const now = Date.UTC(2026, 10, 11);
const HOUR = 3600000;
// Lubigi wetland, Kampala
const at = (dLat = 0, dLng = 0) => ({ lat: 0.3405 + dLat, lng: 32.5419 + dLng });
let n = 0;
const report = (extra = {}) => ({
  id: "NEMA-" + ++n,
  status: "viewed",
  acc: 10,
  ts: now - HOUR,
  type: "Sewage",
  ...at(),
  ...extra,
});

test("reporter app types get sensible weights", () => {
  assert.equal(weightOf({ type: "Sewage" }), 8);
  assert.equal(weightOf({ type: "Oil or chemicals" }), 8);
  assert.equal(weightOf({ type: "Dumping or filling" }), 4);
  assert.equal(weightOf({ type: "Open burning or smoke" }), 4);
  assert.equal(weightOf({ type: "Rubbish or waste" }), 2);
});

test("only reviewed reports with a good GPS fix count", () => {
  const out = computeHotspots(
    [
      report({ status: "new", publicKey: "a" }),
      report({ acc: 400, publicKey: "b" }),
    ],
    now,
  );
  assert.deepEqual(out, []);
});

test("one reporter alone can never make a red hotspot", () => {
  const many = Array.from({ length: 10 }, () => report({ publicKey: "same-phone" }));
  const [h] = computeHotspots(many, now);
  assert.equal(h.singleSource, true);
  assert.equal(h.level, "yellow");
  assert.equal(h.reporterCount, 1);
});

test("several reporters in one place make a red hotspot", () => {
  const out = computeHotspots(
    [report({ publicKey: "a" }), report({ publicKey: "b" }), report({ publicKey: "c" })],
    now,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].level, "red");
  assert.equal(out[0].reportCount, 3);
  assert.equal(out[0].rank, 1);
});

test("old reports count for less", () => {
  const fresh = computeHotspots([report({ publicKey: "a" }), report({ publicKey: "b" })], now);
  const old = computeHotspots(
    [report({ publicKey: "a", ts: now - 28 * 24 * HOUR }), report({ publicKey: "b", ts: now - 28 * 24 * HOUR })],
    now,
  );
  assert.ok(old[0].score < fresh[0].score / 3);
});

test("places far apart are separate hotspots, ranked by score", () => {
  const out = computeHotspots(
    [
      report({ publicKey: "a" }),
      report({ publicKey: "b" }),
      report({ publicKey: "c", ...at(0.05), type: "Sewage" }),
      report({ publicKey: "d", ...at(0.05), type: "Sewage" }),
      report({ publicKey: "e", ...at(0.05), type: "Sewage" }),
    ],
    now,
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].reportCount, 3);
  assert.equal(out[1].rank, 2);
});
