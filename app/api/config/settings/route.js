import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS, getSystemSettings, updateSystemSetting } from "@/lib/settings";
import { requireRole } from "@/lib/guard";
import { logAudit } from "@/lib/db";

export const dynamic = "force-dynamic";
const json = (b, s = 200) => NextResponse.json(b, { status: s });

export async function GET(req) {
  const staff = await requireRole(req, ["admin", "reviewer", "inspector", "legal", "oversight"]);
  if (!staff) return json({ error: "Forbidden" }, 403);
  const settings = await getSystemSettings();
  return json(settings);
}

export async function PATCH(req) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Invalid payload" }, 400);
  }

  const { key, value } = body;
  if (!key || typeof key !== "string" || value === undefined) {
    return json({ error: "Key and value are required" }, 400);
  }
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    return json({ error: "Unknown setting key" }, 400);
  }

  await updateSystemSetting(key, value, admin.email);
  await logAudit(null, admin.email, "update_settings", { key, value });

  const updated = await getSystemSettings();
  return json(updated);
}
