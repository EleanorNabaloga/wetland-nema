import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const DATA_DIR = path.join(process.cwd(), "data");
const FILES = {
  reports: "reports.json",
  staff_users: "staff_users.json",
  identity_vault: "vault.json",
  audit_log: "audit_log.json",
  ai_triage_queue: "ai_triage_queue.json",
  ai_assessments: "ai_assessments.json",
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(fileName, fallback) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return structuredClone(fallback);
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed;
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return structuredClone(fallback);
  }
}

function writeJson(fileName, value) {
  ensureDataDir();
  fs.writeFileSync(
    path.join(DATA_DIR, fileName),
    JSON.stringify(value, null, 2),
  );
}

const tableRows = (name, fallback = []) => {
  const fileName = FILES[name] || `${name}.json`;
  const value = readJson(fileName, fallback);
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  if (value && typeof value === "object") return Object.values(value);
  return fallback;
};

function isJsonFallbackEnabled() {
  if (process.env.USE_LOCAL_DEMO_FALLBACK === "true") return true;
  return !process.env.DATABASE_URL;
}

function makePool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  p.on("error", (err) => console.error("Idle Postgres client error:", err));
  return p;
}

export function getPool() {
  if (!global._pgPool) global._pgPool = makePool();
  return global._pgPool;
}

function seedDefaultUsers() {
  const staff = tableRows("staff_users", []);
  if (staff.length > 0) return staff;

  const defaultEmail = (process.env.DEFAULT_ADMIN_EMAIL || "admin@nema.gov")
    .trim()
    .toLowerCase();
  // The built-in password is for local demos only. In production an admin is
  // seeded only when DEFAULT_ADMIN_PASSWORD is set.
  const defaultPassword =
    process.env.DEFAULT_ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production" ? null : "NemaAdmin!123");
  if (!defaultPassword) return staff;
  const users = [
    {
      email: defaultEmail,
      name: "NEMA Admin",
      password_hash: bcrypt.hashSync(defaultPassword, 10),
      role: "admin",
      status: "active",
      created_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null,
      totp_enabled: false,
      totp_secret: null,
      totp_last_step: 0,
    },
  ];

  const envUsers = (() => {
    const raw = process.env.STAFF_USERS || "[]";
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  for (const item of envUsers) {
    const email = String(item.email || "")
      .trim()
      .toLowerCase();
    if (!email) continue;
    const existing = users.find((u) => u.email === email);
    if (existing) continue;
    users.push({
      email,
      name: item.name || email,
      password_hash: item.hash || item.password_hash || "",
      role: item.role || "reviewer",
      status: item.status || "active",
      created_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null,
      totp_enabled: false,
      totp_secret: null,
      totp_last_step: 0,
    });
  }

  writeJson("staff_users.json", users);
  return users;
}

function currentReports() {
  const rows = tableRows("reports", []);
  return rows.map((r) => ({
    ...r,
    id: String(r.id),
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    acc: r.acc == null ? null : Number(r.acc),
    ts: Number(r.ts ?? r.received_at ?? Date.now()),
    received_at: r.received_at ?? r.receivedAt ?? Number(r.ts ?? Date.now()),
    receivedAt: r.receivedAt ?? r.received_at ?? Number(r.ts ?? Date.now()),
    status: r.status || "new",
    outcome: r.outcome ?? null,
    type: r.type || "Pollution",
    category: r.triage_category ?? r.category ?? null,
    triage_category: r.triage_category ?? r.category ?? null,
    photo_url: r.photo_url ?? r.photo ?? "",
    photo: r.photo ?? r.photo_url ?? "",
  }));
}

function currentVault() {
  return tableRows("identity_vault", []);
}

function makeRow(row, aliasMap = {}) {
  const out = { ...row };
  for (const [key, value] of Object.entries(aliasMap)) {
    if (value != null && !(key in out)) out[key] = value;
  }
  return out;
}

function normalizeReportRow(report, claim = false) {
  const row = {
    id: report.id,
    lat: report.lat,
    lng: report.lng,
    acc: report.acc,
    ts: report.ts,
    type: report.type,
    note: report.note,
    photo: report.photo_url || report.photo || "",
    hash: report.hash,
    source: report.source,
    locationSource: report.location_source || report.locationSource,
    timeSource: report.time_source || report.timeSource,
    publicKey: report.device_public_key || report.publicKey,
    status: report.status,
    outcome: report.outcome,
    viewedAt: report.viewed_at || report.viewedAt,
    reviewedBy: report.reviewed_by || report.reviewedBy,
    category: report.triage_category || report.category,
    triagedAt: report.triaged_at || report.triagedAt,
    triagedBy: report.triaged_by || report.triagedBy,
    inspectedAt: report.inspected_at || report.inspectedAt,
    inspectedBy: report.inspected_by || report.inspectedBy,
    decidedAt: report.decided_at || report.decidedAt,
    receivedAt: Number(
      report.received_at ?? report.receivedAt ?? report.ts ?? Date.now(),
    ),
    claimed: Boolean(claim),
  };

  row.photo_url = row.photo;
  row.viewed_at = row.viewedAt;
  row.reviewed_by = row.reviewedBy;
  row.triage_category = row.category;
  row.triaged_at = row.triagedAt;
  row.triaged_by = row.triagedBy;
  row.inspected_at = row.inspectedAt;
  row.inspected_by = row.inspectedBy;
  row.decided_at = row.decidedAt;
  row.received_at = row.receivedAt;
  row.location_source = row.locationSource;
  row.time_source = row.timeSource;
  row.device_public_key = row.publicKey;
  row.photo_url = row.photo;
  row.aiSeverity = report.ai_severity || report.aiSeverity || null;
  row.aiCategory = report.suggested_category || report.ai_category || report.aiCategory || null;
  row.aiConfidence = report.confidence != null ? report.confidence : (report.aiConfidence != null ? report.aiConfidence : null);
  row.aiUrgency = report.urgency_score != null ? report.urgency_score : (report.aiUrgency != null ? report.aiUrgency : null);
  row.aiReason = report.reason || report.ai_reason || report.aiReason || null;
  return row;
}

function sqlSelectReports(sql, params) {
  const reports = currentReports();
  const claims = Object.fromEntries(
    currentVault().map((item) => [
      String(item.report_id || item.reportId),
      item,
    ]),
  );
  const assessments = Object.fromEntries(
    tableRows("ai_assessments", [])
      .filter((a) => a.is_latest)
      .map((a) => [String(a.report_id), a]),
  );
  const rows = reports
    .map((report) => {
      const merged = { ...report };
      const a = assessments[String(report.id)];
      if (a) {
        merged.aiSeverity = a.severity;
        merged.aiCategory = a.suggested_category;
        merged.aiConfidence = a.confidence;
        merged.aiUrgency = a.urgency_score;
        merged.aiReason = a.reason;
      }
      return normalizeReportRow(merged, claims[String(report.id)]?.claimed === true);
    })
    .sort((a, b) => Number(b.receivedAt || 0) - Number(a.receivedAt || 0));

  if (
    sql.toLowerCase().includes("where r.id = $1") ||
    sql.toLowerCase().includes("where r.id =") ||
    sql.toLowerCase().includes("where id = $1") ||
    sql.toLowerCase().includes("where id =")
  ) {
    const id = String(params[0] || "");
    const matched = rows.filter((row) => String(row.id) === id);
    return { rows: matched, rowCount: matched.length };
  }

  if (sql.toLowerCase().includes("order by r.received_at desc")) {
    return { rows: rows.slice(0, 500), rowCount: rows.length };
  }

  return { rows, rowCount: rows.length };
}

function sqlSelectStaff(sql, params) {
  const users = seedDefaultUsers();
  const normalized = users.map((u) => ({
    email: u.email,
    password_hash: u.password_hash || u.hash || "",
    name: u.name,
    role: u.role,
    status: u.status,
    totp_enabled: !!u.totp_enabled,
    totp_secret: u.totp_secret,
    totp_last_step: Number(u.totp_last_step || 0),
    created_at: u.created_at,
    createdAt: u.created_at,
    decided_at: u.decided_at,
    decidedAt: u.decided_at,
    decided_by: u.decided_by,
    decidedBy: u.decided_by,
  }));

  let rows = [...normalized];
  const email = params[0] ? String(params[0]).toLowerCase() : null;
  if (email) rows = rows.filter((user) => user.email === email);

  if (sql.toLowerCase().includes("where email = $1 and status = 'active'")) {
    rows = rows.filter(
      (user) => user.email === email && user.status === "active",
    );
  }

  if (
    sql.toLowerCase().includes("select email, name, role, status") ||
    sql.toLowerCase().includes("select email, password_hash, role, status")
  ) {
    rows = rows.map((user) => {
      if (
        sql
          .toLowerCase()
          .includes("select email, password_hash, role, status, totp_enabled")
      ) {
        return {
          email: user.email,
          password_hash: user.password_hash,
          role: user.role,
          status: user.status,
          totp_enabled: user.totp_enabled,
        };
      }
      if (sql.toLowerCase().includes("select email, role, status")) {
        return { email: user.email, role: user.role, status: user.status };
      }
      return {
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        createdAt: user.createdAt,
        decided_at: user.decided_at,
        decidedAt: user.decidedAt,
        decided_by: user.decided_by,
        decidedBy: user.decidedBy,
      };
    });
  }

  if (sql.toLowerCase().includes("select role from staff_users")) {
    rows = rows.map((user) => ({ role: user.role }));
  }

  if (
    sql
      .toLowerCase()
      .includes("order by (status = 'pending') desc, created_at desc")
  ) {
    rows.sort(
      (a, b) =>
        Number(b.status === "pending") - Number(a.status === "pending") ||
        new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
    );
  }

  return { rows, rowCount: rows.length };
}

function splitSqlAssignments(setText) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < setText.length; i++) {
    const char = setText[i];
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSetAssignments(setText, params) {
  const entries = [];
  const segments = splitSqlAssignments(setText);
  for (const segment of segments) {
    const eqIndex = segment.indexOf("=");
    if (eqIndex < 0) continue;
    const key = segment.slice(0, eqIndex).trim();
    const raw = segment.slice(eqIndex + 1).trim();
    let value = raw;
    if (/^\$\d+$/.test(raw)) value = params[Number(raw.slice(1)) - 1];
    entries.push({ key, value });
  }
  return entries;
}

function applyReportUpdate(id, sql, params) {
  const rows = currentReports();
  const index = rows.findIndex((entry) => String(entry.id) === String(id));
  if (index < 0) return { rows: [], rowCount: 0 };
  const row = { ...rows[index] };
  const setText = sql.match(/SET\s+(.+?)\s+WHERE\s+/i)?.[1] || "";
  const assignments = parseSetAssignments(setText, params);

  for (const { key, value } of assignments) {
    const field = key.replace(/"/g, "");
    if (field === "status") row.status = value;
    else if (field === "viewed_at")
      row.viewed_at = value === "now()" ? new Date().toISOString() : value;
    else if (field === "reviewed_by") row.reviewed_by = value;
    else if (field === "triage_category") row.triage_category = value;
    else if (field === "triaged_at")
      row.triaged_at =
        value === "now()"
          ? new Date().toISOString()
          : row.triaged_at || new Date().toISOString();
    else if (field === "triaged_by") row.triaged_by = value;
    else if (field === "inspected_at")
      row.inspected_at =
        typeof value === "string" && value.toLowerCase().includes("coalesce")
          ? row.inspected_at || new Date().toISOString()
          : value === "now()"
            ? new Date().toISOString()
            : value;
    else if (field === "inspected_by")
      row.inspected_by =
        typeof value === "string" && value.toLowerCase().includes("coalesce")
          ? row.inspected_by || params[1]
          : value;
    else if (field === "outcome") row.outcome = value;
    else if (field === "decided_at")
      row.decided_at =
        value == null || value === "NULL" || value === "null"
          ? null
          : new Date().toISOString();
    else if (field === "received_at") row.received_at = value;
    else row[field] = value;
  }

  if (sql.toLowerCase().includes("status = 'viewed'")) {
    row.status = "viewed";
    row.viewed_at = row.viewed_at || new Date().toISOString();
    row.reviewed_by = params[1];
  }

  rows[index] = row;
  writeJson("reports.json", rows);
  return { rows: [{ ...row }], rowCount: 1 };
}

function applyStaffUpdate(email, sql, params) {
  const users = seedDefaultUsers();
  const idx = users.findIndex(
    (entry) => entry.email === String(email).toLowerCase(),
  );
  if (idx < 0) return { rows: [], rowCount: 0 };
  const row = { ...users[idx] };
  const setText = sql.match(/SET\s+(.+?)\s+WHERE\s+/i)?.[1] || "";
  const assignments = parseSetAssignments(setText, params);

  for (const { key, value } of assignments) {
    const field = key.replace(/"/g, "");
    if (field === "status") row.status = value;
    else if (field === "role") row.role = value;
    else if (field === "decided_by") row.decided_by = value;
    else if (field === "decided_at") row.decided_at = new Date().toISOString();
    else if (field === "totp_secret") row.totp_secret = value;
    else if (field === "totp_enabled")
      row.totp_enabled = value === true || value === "true";
    else if (field === "totp_last_step")
      row.totp_last_step = Number(value || 0);
    else row[field] = value;
  }

  users[idx] = row;
  writeJson("staff_users.json", users);
  return { rows: [{ ...row }], rowCount: 1 };
}

function jsonQuery(text, params = []) {
  const sql = String(text || "");
  const low = sql.toLowerCase();

  if (low.startsWith("select ") && low.includes("from reports"))
    return sqlSelectReports(sql, params);
  if (low.startsWith("select ") && low.includes("from staff_users"))
    return sqlSelectStaff(sql, params);
  if (low.startsWith("insert into audit_log")) {
    const rows = tableRows("audit_log", []);
    const reportId = params[0];
    const officerEmail = params[1];
    const action = params[2];
    const detail = params[3];
    rows.push({
      report_id: reportId,
      officer_email: officerEmail,
      action,
      detail: detail
        ? typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
        : null,
      created_at: new Date().toISOString(),
    });
    writeJson("audit_log.json", rows);
    return {
      rows: [
        { report_id: reportId, officer_email: officerEmail, action, detail },
      ],
      rowCount: 1,
    };
  }

  if (low.startsWith("insert into staff_users")) {
    const users = seedDefaultUsers();
    const email = String(params[0]).trim().toLowerCase();
    const name = String(params[1] || "");
    const hash = params[2];
    if (users.some((u) => u.email === email)) {
      return { rows: [], rowCount: 0 };
    }
    users.push({
      email,
      name,
      password_hash: hash,
      role: "reviewer",
      status: "pending",
      created_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null,
      totp_enabled: false,
      totp_secret: null,
      totp_last_step: 0,
    });
    writeJson("staff_users.json", users);
    return { rows: [{ email }], rowCount: 1 };
  }

  if (low.startsWith("insert into reports")) {
    const reports = currentReports();
    // The API sends one value per column, in the order the SQL lists them.
    // Pair each value with its column name.
    const cols = sql
      .match(/insert into reports\s*\(([^)]+)\)/i)?.[1]
      .split(",")
      .map((c) => c.trim());
    const body =
      cols && cols.length === params.length
        ? Object.fromEntries(cols.map((c, i) => [c, params[i]]))
        : params[0] || {};
    const id = body.id || `NEMA-${Date.now()}`;
    const rec = {
      id,
      lat: Number(body.lat ?? 0),
      lng: Number(body.lng ?? 0),
      acc: body.acc == null ? null : Number(body.acc),
      ts: Number(body.ts ?? Date.now()),
      received_at: Number(body.received_at ?? body.ts ?? Date.now()),
      receivedAt: Number(
        body.receivedAt ?? body.received_at ?? body.ts ?? Date.now(),
      ),
      type: body.type || "Pollution",
      note: body.note || "",
      photo: body.photo || body.photo_url || "",
      photo_url: body.photo_url || body.photo || "",
      hash: body.hash || null,
      source: body.source || "mobile",
      location_source: body.locationSource || body.location_source || "gps",
      time_source: body.timeSource || body.time_source || "device",
      device_public_key: body.publicKey || body.device_public_key || null,
      status: body.status || "new",
      outcome: body.outcome || null,
      viewed_at: body.viewedAt || body.viewed_at || null,
      reviewed_by: body.reviewedBy || body.reviewed_by || null,
      triage_category: body.category || body.triage_category || null,
      triaged_at: body.triagedAt || body.triaged_at || null,
      triaged_by: body.triagedBy || body.triaged_by || null,
      inspected_at: body.inspectedAt || body.inspected_at || null,
      inspected_by: body.inspectedBy || body.inspected_by || null,
      decided_at: body.decidedAt || body.decided_at || null,
      created_at: new Date().toISOString(),
    };
    reports.unshift(rec);
    writeJson("reports.json", reports);
    return { rows: [{ id, ok: true }], rowCount: 1 };
  }

  if (
    low.startsWith("create table") ||
    low.startsWith("alter table") ||
    low.startsWith("create index") ||
    low.startsWith("create unique index")
  ) {
    return { rows: [], rowCount: 0 };
  }

  if (low.includes("update ai_triage_queue")) {
    const queue = tableRows("ai_triage_queue", []);
    if (low.includes("set status = 'processing'")) {
      const nowMs = Date.now();
      const pending = queue
        .filter(
          (job) =>
            (job.status === "pending" ||
              (job.status === "processing" &&
                new Date(job.locked_at || 0).getTime() < nowMs - 300000)) &&
            (job.attempts || 0) < (job.max_attempts || 3),
        )
        .slice(0, 10);
      for (const job of pending) {
        job.status = "processing";
        job.attempts = (job.attempts || 0) + 1;
        job.locked_at = new Date().toISOString();
        job.updated_at = new Date().toISOString();
      }
      writeJson("ai_triage_queue.json", queue);
      return {
        rows: pending.map((j) => ({
          id: j.id,
          reportId: j.report_id,
          attempts: j.attempts,
        })),
        rowCount: pending.length,
      };
    }
    const id = params[0];
    const job = queue.find((j) => String(j.id) === String(id));
    if (job) {
      if (low.includes("status = 'completed'")) {
        job.status = "completed";
        job.tier_executed = params[1] || job.tier_executed;
        job.locked_at = null;
        job.updated_at = new Date().toISOString();
      } else {
        job.status =
          (job.attempts || 0) >= (job.max_attempts || 3)
            ? "failed"
            : "pending";
        job.last_error = params[1] || null;
        job.locked_at = null;
        job.updated_at = new Date().toISOString();
      }
      writeJson("ai_triage_queue.json", queue);
    }
    return { rows: [], rowCount: 1 };
  }

  if (low.startsWith("insert into ai_triage_queue")) {
    const queue = tableRows("ai_triage_queue", []);
    const reportId = params[0];
    if (reportId && !queue.some((j) => String(j.report_id) === String(reportId))) {
      const nextId =
        queue.length > 0
          ? Math.max(...queue.map((j) => Number(j.id) || 0)) + 1
          : 1;
      queue.push({
        id: nextId,
        report_id: reportId,
        status: params[1] || "pending",
        attempts: 0,
        max_attempts: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      writeJson("ai_triage_queue.json", queue);
    }
    return { rows: [], rowCount: 1 };
  }

  if (low.startsWith("insert into field_inspections")) {
    const inspections = tableRows("field_inspections", []);
    const rec = {
      id: params[0],
      report_id: params[1],
      ranger_email: params[2],
      certificate_number: params[3],
      lat: Number(params[4]),
      lng: Number(params[5]),
      distance_m: Number(params[6]),
      photo_url: params[7] || null,
      water_ph: params[8] != null ? Number(params[8]) : null,
      water_clarity: params[9] || null,
      odor: params[10] || null,
      findings_summary: params[11] || null,
      action_recommended: params[12] || null,
      forced: Boolean(params[13]),
      force_reason: params[14] || null,
      created_at: new Date().toISOString(),
    };
    inspections.unshift(rec);
    writeJson("field_inspections.json", inspections);
    return { rows: [rec], rowCount: 1 };
  }

  if (low.startsWith("select ") && low.includes("from field_inspections")) {
    const inspections = tableRows("field_inspections", []);
    const targetId = params[0];
    const filtered = targetId
      ? inspections.filter(
          (i) =>
            String(i.report_id) === String(targetId) ||
            String(i.id) === String(targetId),
        )
      : inspections;
    const mapped = filtered.map((r) => ({
      ...r,
      reportId: r.report_id,
      rangerEmail: r.ranger_email,
      certificateNumber: r.certificate_number,
      distanceM: r.distance_m,
      photoUrl: r.photo_url,
      waterPh: r.water_ph,
      waterClarity: r.water_clarity,
      findingsSummary: r.findings_summary,
      actionRecommended: r.action_recommended,
      forced: Boolean(r.forced),
      forceReason: r.force_reason || null,
      createdAt: r.created_at,
    }));
    return { rows: mapped, rowCount: mapped.length };
  }

  if (low.startsWith("select ") && low.includes("from system_settings")) {
    const settings = tableRows("system_settings", []);
    return { rows: settings, rowCount: settings.length };
  }

  if (low.startsWith("insert into system_settings")) {
    const settings = tableRows("system_settings", []);
    const key = String(params[0]);
    const rawVal = params[1];
    let parsedVal = rawVal;
    if (typeof rawVal === "string") {
      try {
        parsedVal = JSON.parse(rawVal);
      } catch {}
    }
    const existing = settings.find((s) => s.key === key);
    if (existing) {
      existing.value = parsedVal;
      existing.updated_at = new Date().toISOString();
      existing.updated_by = params[2] || "system";
    } else {
      settings.push({
        key,
        value: parsedVal,
        updated_at: new Date().toISOString(),
        updated_by: params[2] || "system",
      });
    }
    writeJson("system_settings.json", settings);
    return { rows: [], rowCount: 1 };
  }

  if (low.startsWith("insert into ai_assessments")) {
    const assessments = tableRows("ai_assessments", []);
    const reportId = params[0];
    const rec = {
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      report_id: reportId,
      model_id: params[1],
      prompt_version: params[2],
      severity: params[3],
      suggested_category: params[4],
      suggested_outcome: params[5],
      confidence: params[6],
      urgency_score: params[7],
      key_evidence_tags: params[8] || [],
      reason: params[9],
      tier_executed: params[10],
      is_latest: true,
      created_at: new Date().toISOString(),
    };
    for (const a of assessments) {
      if (a.report_id === reportId) a.is_latest = false;
    }
    assessments.unshift(rec);
    writeJson("ai_assessments.json", assessments);
    return { rows: [rec], rowCount: 1 };
  }

  if (low.startsWith("update ai_assessments")) {
    const assessments = tableRows("ai_assessments", []);
    const reportId = params[0];
    const action = params[1];
    const actionedBy = params[2];
    for (const a of assessments) {
      if (String(a.report_id) === String(reportId) && a.is_latest) {
        a.officer_action = action;
        a.actioned_at = new Date().toISOString();
        a.actioned_by = actionedBy;
      }
    }
    writeJson("ai_assessments.json", assessments);
    return { rows: [], rowCount: 1 };
  }

  if (low.startsWith("update reports set")) {
    const id = String(params[0] || "");
    const res = applyReportUpdate(id, sql, params);
    return res;
  }

  if (low.startsWith("update staff_users set")) {
    const email = String(params[0] || "").toLowerCase();
    // Pass all values: $N in the SET clause counts from the email ($1).
    const res = applyStaffUpdate(email, sql, params);
    return res;
  }

  if (low.startsWith("delete from reports")) {
    writeJson("reports.json", []);
    return { rows: [], rowCount: 0 };
  }

  if (low.startsWith("select status, outcome, triage_category")) {
    const id = String(params[0] || "");
    const report = currentReports().find((entry) => String(entry.id) === id);
    if (!report) return { rows: [], rowCount: 0 };
    const row = {
      status: report.status,
      outcome: report.outcome,
      triage_category: report.triage_category || report.category || null,
      inspected_at: report.inspected_at || report.inspectedAt || null,
      decided_at: report.decided_at || report.decidedAt || null,
    };
    return { rows: [row], rowCount: 1 };
  }

  if (low.startsWith("select email, name, role, status")) {
    return sqlSelectStaff(sql, params);
  }

  if (low.startsWith("select email, role, status")) {
    return sqlSelectStaff(sql, params);
  }

  return { rows: [], rowCount: 0 };
}

export function query(text, params = []) {
  return isJsonFallbackEnabled()
    ? jsonQuery(text, params)
    : getPool().query(text, params);
}

export async function withTransaction(fn) {
  if (isJsonFallbackEnabled()) {
    return fn((text, params) => query(text, params));
  }

  const client = await getPool().connect();
  let rollbackError = null;
  try {
    await client.query("BEGIN");
    const result = await fn((text, params) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch((rbErr) => {
      rollbackError = rbErr;
    });
    throw err;
  } finally {
    client.release(rollbackError);
  }
}

export async function logAudit(
  reportId,
  officerEmail,
  action,
  detail = null,
  run = query,
) {
  await run(
    `INSERT INTO audit_log (report_id, officer_email, action, detail) VALUES ($1, $2, $3, $4)`,
    [reportId, officerEmail, action, detail ? JSON.stringify(detail) : null],
  );
}
