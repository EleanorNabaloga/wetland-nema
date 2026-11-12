import { query } from "./db.js";
import { ensureAiTables } from "./schema.js";

export const DEFAULT_SETTINGS = {
  sla_limits: {
    acknowledge_days: 2,
    triage_days: 7,
    inspect_emergency_days: 3,
    inspect_routine_days: 30,
    decide_days: 45
  },
  hotspot_weights: {
    "Sewer spill": 8,
    "Industrial waste / chemicals": 8,
    "Open burning / smoke": 4,
    "Blocked drainage": 4,
    "Wetland encroachment": 6,
    "Rubbish heap (kasasiro)": 2,
    "Plastic waste": 2,
    "Other": 1
  },
  photo_duplicate_limits: {
    reject_hamming_distance: 5,
    flag_hamming_distance: 10,
    same_place_meters: 300,
    different_place_meters: 500,
    incident_time_hours: 48
  },
  camera_advisory_limits: {
    min_brightness: 40,
    max_brightness: 240,
    max_blur_score: 100,
    max_check_time_ms: 30
  },
  ai_governance: {
    display_mode: "assisted", // "silent" during silent run, "assisted" during live review
    min_agreement_rate: 0.80, // 80% officer agreement threshold required for live badges
    emergency_recall_threshold: 0.95
  },
  language_keywords: {
    emergency_luganda: ["obutwa", "amakolero", "kazambi", "obukyafu", "omuliro", "ekidiba"],
    emergency_english: ["poison", "toxic", "chemical", "factory", "industrial", "sewage", "spill"],
    emergency_runyankole: ["oburogo", "obuzibu", "omwonyo"],
    emergency_acholi: ["kwaro", "kwo", "kwot"],
    emergency_ateso: ["etor", "ejiiko", "apolon"],
    negation_luganda: ["ssi", "si", "tekiri", "tewali"],
    negation_english: ["not", "no", "never", "without", "clean"]
  }
};

function deepMerge(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return source !== undefined ? source : target;
  }
  const result = { ...(target || {}) };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

let cachedSettings = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000;

export async function getSystemSettings() {
  const now = Date.now();
  if (cachedSettings && now - lastCacheTime < CACHE_TTL_MS) {
    return structuredClone(cachedSettings);
  }

  await ensureAiTables().catch(() => {});

  try {
    const res = await query(`SELECT key, value FROM system_settings`);
    const dbSettings = {};
    if (res?.rows) {
      for (const row of res.rows) {
        if (typeof row.value === "string") {
          try {
            dbSettings[row.key] = JSON.parse(row.value);
          } catch {
            // Skip malformed JSON setting row without discarding other settings
          }
        } else if (row.value !== undefined) {
          dbSettings[row.key] = row.value;
        }
      }
    }

    cachedSettings = deepMerge(DEFAULT_SETTINGS, dbSettings);
    lastCacheTime = now;
    return structuredClone(cachedSettings);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function updateSystemSetting(key, value, updatedBy = "system") {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    throw new Error(`Unknown system setting key: ${String(key)}`);
  }
  await ensureAiTables().catch(() => {});
  const current = await getSystemSettings().catch(() => structuredClone(DEFAULT_SETTINGS));
  const mergedValue =
    value && typeof value === "object" && !Array.isArray(value) && typeof current[key] === "object"
      ? deepMerge(current[key], value)
      : value;

  await query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(mergedValue), updatedBy]
  );
  cachedSettings = null;
  lastCacheTime = 0;
}

export function applyAiDisplayMode(rowOrRows, settings) {
  const isSilent = settings?.ai_governance?.display_mode === "silent";
  if (!isSilent || !rowOrRows) return rowOrRows;
  const redact = (r) => ({
    ...r,
    aiSeverity: null,
    aiCategory: null,
    aiConfidence: null,
    aiUrgency: null,
    aiReason: null,
  });
  return Array.isArray(rowOrRows) ? rowOrRows.map(redact) : redact(rowOrRows);
}
