// Privacy-preserving coordinate rounding and note redaction utilities

export function quantizeCoordinates(lat, lng) {
  if (lat == null || lng == null) return null;
  if (lat === "" || lng === "") return null;
  const nLat = typeof lat === "string" ? parseFloat(lat) : Number(lat);
  const nLng = typeof lng === "string" ? parseFloat(lng) : Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return {
    lat: Math.round(nLat * 1000) / 1000,
    lng: Math.round(nLng * 1000) / 1000,
  };
}

export function sanitizeCitizenNote(note) {
  if (!note || typeof note !== "string") return "";
  // Slice to 1000 characters first to prevent excessive processing on massive inputs
  const bounded = note.slice(0, 1000);
  return bounded
    // Formatted and unformatted Ugandan phone numbers (e.g. +256 772 123 456, +256 0772 123456, 0701-987-654, 0772123456)
    .replace(/(?:\+?256[\s.-]?(?:0)?[37]\d|0[37]\d)(?:[\s.-]?\d){7,8}\b/g, "[REDACTED_CONTACT]")
    // Ugandan National Identification Number (NIN): 14 characters starting with CM or CF
    .replace(/\b[CF][MF][0-9A-HJ-NP-RT-Z]{12}\b/gi, "[REDACTED_NIN]")
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .slice(0, 300);
}
