import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { getTrustForReport } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const staff = await requireRole(req, ["reviewer", "inspector", "legal"]);
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("report");
    if (!id) return NextResponse.json({ error: "report is required" }, { status: 400 });
    return NextResponse.json(await getTrustForReport(id));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
