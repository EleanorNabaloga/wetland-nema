const DAY_MS = 86400000;
const THIRTY_DAYS_MS = 30 * DAY_MS;

export const FRAUD_THRESHOLDS = {
  SAME_PAYOUT_MULTIPLE_DEVICES: 2, // flag if > 2 devices use the same payout fingerprint
  BURST_CLAIMS_PER_DAY: 3,         // flag if >= 3 claims to same fingerprint in 24 hours
  MONTHLY_CLAIMS_PER_DEVICE: 5,   // flag if >= 5 claims from same device key in 30 days
};

/**
 * Evaluates whether an individual reward claim should be held for human fraud review.
 * Operates purely on non-PII keyed fingerprints and cryptographic public keys.
 * 
 * @param {Object} claim - { reportId, fingerprint, publicKey, claimTs, markedFalse }
 * @param {Array} history - Array of historical claims
 * @returns {Object} { held: boolean, reasons: string[] }
 */
export function evaluateClaim(claim, history = []) {
  if (!claim) {
    return { held: false, reasons: [] };
  }

  const reasons = [];
  const claimTime = Number(claim.claimTs) || Date.now();
  const all = [...history, claim];

  // 1. Check if same payout number fingerprint has claimed across multiple devices
  if (claim.fingerprint) {
    const devicesForFp = new Set();
    for (const c of all) {
      if (c.fingerprint === claim.fingerprint && c.publicKey) {
        devicesForFp.add(c.publicKey);
      }
    }
    if (devicesForFp.size > FRAUD_THRESHOLDS.SAME_PAYOUT_MULTIPLE_DEVICES) {
      reasons.push(
        `One payout number has claimed for ${devicesForFp.size} different phones.`,
      );
    }

    // 2. Unusual bursts to one fingerprint within 24 hours
    const burstCount = all.filter(
      (c) =>
        c.fingerprint === claim.fingerprint &&
        Math.abs(claimTime - (Number(c.claimTs) || claimTime)) <= DAY_MS,
    ).length;

    if (burstCount >= FRAUD_THRESHOLDS.BURST_CLAIMS_PER_DAY) {
      reasons.push(
        `Unusual burst of claims (${burstCount} claims within 24 hours).`,
      );
    }
  }

  // 3. High claim frequency from one device within 30 days
  if (claim.publicKey) {
    const monthlyCount = all.filter(
      (c) =>
        c.publicKey === claim.publicKey &&
        Math.abs(claimTime - (Number(c.claimTs) || claimTime)) <= THIRTY_DAYS_MS,
    ).length;

    if (monthlyCount >= FRAUD_THRESHOLDS.MONTHLY_CLAIMS_PER_DEVICE) {
      reasons.push(
        `High claim volume from single device (${monthlyCount} claims this month).`,
      );
    }
  }

  // 4. Report was marked false
  if (claim.markedFalse) {
    reasons.push("Incident report was marked as false.");
  }

  return {
    held: reasons.length > 0,
    reasons,
  };
}

/**
 * Scans a list of claims and returns all claims that require managerial review.
 * Omits full fingerprints to ensure zero-PII in presentation.
 * 
 * @param {Array} claims
 * @returns {Array} List of held claims with reasons
 */
export function detectFraudPatterns(claims = []) {
  const list = Array.isArray(claims) ? claims : [];
  const heldClaims = [];

  for (let i = 0; i < list.length; i++) {
    const current = list[i];
    // Exclude the current claim from history when evaluating
    const otherClaims = list.filter((_, idx) => idx !== i);
    const evaluation = evaluateClaim(current, otherClaims);

    if (evaluation.held || current.payoutHeld) {
      const allReasons = Array.from(
        new Set([
          ...(current.payoutHoldReason ? [current.payoutHoldReason] : []),
          ...evaluation.reasons,
        ]),
      );

      heldClaims.push({
        reportId: current.reportId || current.id,
        fingerprintPrefix: current.fingerprint
          ? `${current.fingerprint.slice(0, 8)}...`
          : "N/A",
        devicePrefix: current.publicKey
          ? `${current.publicKey.slice(0, 8)}...`
          : "N/A",
        claimTs: current.claimTs,
        reasons: allReasons,
        held: true,
      });
    }
  }

  return heldClaims;
}
