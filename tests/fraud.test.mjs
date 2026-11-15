import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClaim, detectFraudPatterns } from "../lib/fraud.js";

const DAY = 86400000;

test("legitimate claim from a single device passes without hold", () => {
  const claim = {
    reportId: "rep-1",
    fingerprint: "aaaa1111bbbb2222cccc3333dddd4444",
    publicKey: "dev-key-1",
    claimTs: Date.now(),
  };

  const res = evaluateClaim(claim, []);
  assert.equal(res.held, false);
  assert.deepEqual(res.reasons, []);
});

test("same payout fingerprint used across more than 2 different devices triggers hold", () => {
  const now = Date.now();
  const history = [
    {
      reportId: "rep-1",
      fingerprint: "fp-shared-123456",
      publicKey: "phone-A",
      claimTs: now - 10 * DAY,
    },
    {
      reportId: "rep-2",
      fingerprint: "fp-shared-123456",
      publicKey: "phone-B",
      claimTs: now - 5 * DAY,
    },
  ];

  // 3rd distinct phone using same payout number
  const current = {
    reportId: "rep-3",
    fingerprint: "fp-shared-123456",
    publicKey: "phone-C",
    claimTs: now,
  };

  const res = evaluateClaim(current, history);
  assert.equal(res.held, true);
  assert.ok(res.reasons.some((r) => r.includes("different phones")));
});

test("burst of 3 claims to same fingerprint in 24 hours triggers hold", () => {
  const now = Date.now();
  const history = [
    {
      reportId: "rep-1",
      fingerprint: "fp-burst",
      publicKey: "phone-A",
      claimTs: now - 2 * 3600000, // 2 hours ago
    },
    {
      reportId: "rep-2",
      fingerprint: "fp-burst",
      publicKey: "phone-A",
      claimTs: now - 1 * 3600000, // 1 hour ago
    },
  ];

  const current = {
    reportId: "rep-3",
    fingerprint: "fp-burst",
    publicKey: "phone-A",
    claimTs: now,
  };

  const res = evaluateClaim(current, history);
  assert.equal(res.held, true);
  assert.ok(res.reasons.some((r) => r.includes("Unusual burst")));
});

test("high monthly claim volume from single device triggers hold", () => {
  const now = Date.now();
  const history = [
    { reportId: "r-1", fingerprint: "fp-1", publicKey: "dev-freq", claimTs: now - 25 * DAY },
    { reportId: "r-2", fingerprint: "fp-2", publicKey: "dev-freq", claimTs: now - 20 * DAY },
    { reportId: "r-3", fingerprint: "fp-3", publicKey: "dev-freq", claimTs: now - 15 * DAY },
    { reportId: "r-4", fingerprint: "fp-4", publicKey: "dev-freq", claimTs: now - 10 * DAY },
  ];

  // 5th claim this month
  const current = {
    reportId: "r-5",
    fingerprint: "fp-5",
    publicKey: "dev-freq",
    claimTs: now,
  };

  const res = evaluateClaim(current, history);
  assert.equal(res.held, true);
  assert.ok(res.reasons.some((r) => r.includes("High claim volume from single device")));
});

test("marked false report triggers payout hold", () => {
  const claim = {
    reportId: "rep-false",
    fingerprint: "fp-single",
    publicKey: "dev-1",
    markedFalse: true,
  };

  const res = evaluateClaim(claim, []);
  assert.equal(res.held, true);
  assert.ok(res.reasons.some((r) => r.includes("marked as false")));
});

test("detectFraudPatterns returns safe non-PII prefixes only", () => {
  const claims = [
    {
      reportId: "rep-shared-1",
      fingerprint: "11223344556677889900aabbccddeeff",
      publicKey: "dev-A-1111222233334444",
      claimTs: Date.now(),
    },
    {
      reportId: "rep-shared-2",
      fingerprint: "11223344556677889900aabbccddeeff",
      publicKey: "dev-B-5555666677778888",
      claimTs: Date.now(),
    },
    {
      reportId: "rep-shared-3",
      fingerprint: "11223344556677889900aabbccddeeff",
      publicKey: "dev-C-9999000011112222",
      claimTs: Date.now(),
    },
  ];

  const held = detectFraudPatterns(claims);
  assert.equal(held.length, 3);
  // Full fingerprint should never be present in UI representation
  assert.equal(held[0].fingerprintPrefix, "11223344...");
  assert.equal(held[0].devicePrefix, "dev-A-11...");
  assert.equal(held[0].held, true);
});
