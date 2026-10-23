import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

// One report's photo, for staff only. The report list no longer carries
// photos (they were ~97% of its size); the dashboard loads each one from here
// and the browser keeps it, because a report's photo never changes.
const STAFF_ROLES = ["reviewer", "inspector", "legal"];

export async function GET(req, { params }) {
  try {
    if (!(await requireRole(req, STAFF_ROLES)))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const res = await query(`SELECT r.photo_url FROM reports r WHERE r.id = $1`, [id]);
    const photo = res.rows[0] && res.rows[0].photo_url;
    if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(photo);
    if (!m) {
      // Stored as a link (older storage): send the browser there.
      if (/^https:\/\//i.test(photo)) return NextResponse.redirect(photo, 302);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: {
        "Content-Type": m[1],
        // Private: only this officer's browser keeps it, for a day.
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
