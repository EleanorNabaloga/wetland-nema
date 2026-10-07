"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ago } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import {
  CATEGORIES,
  NEEDS_INSPECTION,
  STAGE_LABEL,
  slaInfo,
  fmtSpan,
} from "@/lib/sla";

const OUTCOMES = [
  "",
  "Inspector will visit",
  "Referred to another agency",
  "Need more information",
];
const JSON_HEADERS = { "Content-Type": "application/json" };
const IS_DEMO = process.env.NODE_ENV !== "production";
const OVERDUE = { background: "#7f1d1d", color: "#fecaca" };

function mapUrl(r) {
  const d = 0.0025;
  const bbox = [r.lng - d, r.lat - d, r.lng + d, r.lat + d].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${r.lat}%2C${r.lng}`;
}
const StatusBadge = ({ r }) =>
  r.status === "viewed" ? (
    <span className="badge b-ok">Reviewed</span>
  ) : (
    <span className="badge b-new">New</span>
  );
const AccBadge = ({ r }) => (
  <span
    className={"badge " + (r.acc != null && r.acc <= 30 ? "b-ok" : "b-new")}
  >
    {r.acc == null ? "GPS accuracy unavailable" : `GPS ±${Math.round(r.acc)} m`}
  </span>
);

function SlaBadge({ r }) {
  const s = slaInfo(r);
  if (s.stage === "done") return <span className="badge b-ok">Closed</span>;
  return (
    <span
      className={"badge " + (s.overdue ? "" : "b-ok")}
      style={s.overdue ? OVERDUE : undefined}
    >
      {STAGE_LABEL[s.stage]}:{" "}
      {s.overdue ? "overdue " + fmtSpan(s.left) : "due in " + fmtSpan(s.left)}
    </span>
  );
}
const when = (v) => (v ? new Date(v).toLocaleString() : "Not yet");

export default function Dashboard() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState(null);
  const [error, setError] = useState("");

  const signedOut = useCallback(() => {
    router.push("/login?next=/dashboard");
    router.refresh();
  }, [router]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/reports", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) return signedOut();
      if (r.ok) setReports(await r.json());
    } catch {}
  }, [signedOut]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function patch(id, body) {
    setError("");
    try {
      const res = await fetch("/api/reports/" + id, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        signedOut();
        return false;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(
          res.status === 403
            ? "Your role cannot make changes."
            : d.error || "Could not save that change.",
        );
        return false;
      }
      return true;
    } catch {
      setError("Could not reach the server. Try again.");
      return false;
    }
  }
  const act = async (id, body) => {
    if (await patch(id, body)) load();
  };

  async function clearAll() {
    if (!confirm("Delete all demo reports?")) return;
    const res = await fetch("/api/reports", { method: "DELETE" });
    if (res.status === 401) return signedOut();
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not clear demo data.");
      return;
    }
    setSelId(null);
    load();
  }

  const nNew = reports.filter((r) => r.status === "new").length;
  const nOver = reports.filter((r) => slaInfo(r).overdue).length;
  const list = reports.filter(
    (r) =>
      filter === "all" ||
      (filter === "new" && r.status === "new") ||
      (filter === "overdue" && slaInfo(r).overdue),
  );
  const sel = reports.find((r) => r.id === selId);
  const reviewed = sel && sel.status === "viewed";
  const needsInspection = sel && NEEDS_INSPECTION.includes(sel.category);

  return (
    <div className="dash">
      <header className="bar">
        <span className="logo">Wetland Watch · NEMA dashboard</span>
        <span>
          {IS_DEMO && (
            <>
              {" "}
              ·{" "}
              <button type="button" className="ghost" onClick={clearAll}>
                Clear demo data
              </button>
            </>
          )}{" "}
          · <LogoutButton />
        </span>
      </header>

      <div className="stats">
        <div className="stat">
          <b>{nNew}</b>
          <span className="muted">New</span>
        </div>
        <div className="stat">
          <b>{nOver}</b>
          <span className="muted">Overdue</span>
        </div>
        <div className="stat">
          <b>{reports.length}</b>
          <span className="muted">All reports</span>
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Filter">
        {[
          ["all", "All"],
          ["new", "New"],
          ["overdue", "Overdue"],
        ].map(([f, label]) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}

      <div className="cols">
        <ul className="list">
          {list.length === 0 && (
            <li className="empty">
              {reports.length ? "Nothing here." : "No reports yet."}
            </li>
          )}
          {list.map((r) => (
            <li key={r.id} className={r.id === selId ? "sel" : ""}>
              <button type="button" onClick={() => setSelId(r.id)}>
                <img alt="" src={r.photo} />
                <span className="grow">
                  <span className="t">
                    {r.id} · {r.category || r.type || "Pollution"}
                  </span>
                  <br />
                  <span className="muted">
                    {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · {ago(r.ts)}
                  </span>
                  <br />
                  <SlaBadge r={r} />
                </span>
                <StatusBadge r={r} />
              </button>
            </li>
          ))}
        </ul>

        <div className="detail" aria-live="polite">
          {!sel ? (
            <p className="empty">
              Select a report to see the photo and location.
            </p>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>
                {sel.id} <StatusBadge r={sel} /> <AccBadge r={sel} />
              </h2>
              <p>
                <SlaBadge r={sel} />
              </p>
              <img className="photo" alt="Evidence photo" src={sel.photo} />
              <iframe
                key={sel.id}
                title="Map of where the photo was taken"
                loading="lazy"
                src={mapUrl(sel)}
              />
              <p className="note">
                <a
                  className="link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lng}#map=18/${sel.lat}/${sel.lng}`}
                >
                  Open larger map
                </a>{" "}
                (needs internet)
              </p>
              <dl className="kv">
                <dt>Type</dt>
                <dd>{sel.type || "Not stated"}</dd>
                <dt>Note</dt>
                <dd>{sel.note || "None"}</dd>
                <dt>Coordinates</dt>
                <dd>
                  {sel.lat.toFixed(6)}, {sel.lng.toFixed(6)}
                </dd>
                <dt>GPS accuracy</dt>
                <dd>
                  {sel.acc == null
                    ? "Not available"
                    : `±${Math.round(sel.acc)} m`}
                </dd>
                <dt>Submitted via</dt>
                <dd>{sel.source || "Not stated"}</dd>
                <dt>Location source</dt>
                <dd>{sel.locationSource || "Not stated"}</dd>
                <dt>Time source</dt>
                <dd>{sel.timeSource || "Not stated"}</dd>
                <dt>Captured</dt>
                <dd>{new Date(sel.ts).toLocaleString()}</dd>
                <dt>Received</dt>
                <dd>{when(sel.receivedAt)}</dd>
                <dt>Reviewed</dt>
                <dd>
                  {when(sel.viewedAt)}
                  {sel.reviewedBy ? " by " + sel.reviewedBy : ""}
                </dd>
                <dt>Triaged</dt>
                <dd>
                  {sel.category
                    ? sel.category + " · " + when(sel.triagedAt)
                    : "Not yet"}
                </dd>
                <dt>Inspected</dt>
                <dd>
                  {needsInspection
                    ? when(sel.inspectedAt)
                    : sel.category
                      ? "Not required"
                      : "Not yet"}
                </dd>
                <dt>Decided</dt>
                <dd>{when(sel.decidedAt)}</dd>
                <dt>Evidence hash</dt>
                <dd>
                  <code>{sel.hash.slice(0, 16)}…</code>
                </dd>
              </dl>

              {!reviewed && (
                <button
                  type="button"
                  className="big"
                  style={{ minHeight: 48, marginBottom: 12 }}
                  onClick={() => act(sel.id, { view: true })}
                >
                  Mark as reviewed
                </button>
              )}

              <label
                className="label"
                htmlFor="cat"
                style={{ display: "block" }}
              >
                Triage category
              </label>
              <select
                id="cat"
                value={sel.category || ""}
                disabled={!reviewed}
                onChange={(e) =>
                  e.target.value && act(sel.id, { category: e.target.value })
                }
              >
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {needsInspection && !sel.inspectedAt && (
                <button
                  type="button"
                  className="big"
                  style={{ minHeight: 48, margin: "12px 0" }}
                  onClick={() => act(sel.id, { inspected: true })}
                >
                  Mark inspection done
                </button>
              )}

              <label
                className="label"
                htmlFor="out"
                style={{ display: "block", marginTop: 12 }}
              >
                Next step (the reporter sees this)
              </label>
              <select
                id="out"
                value={sel.outcome || ""}
                disabled={!reviewed}
                onChange={(e) => act(sel.id, { outcome: e.target.value })}
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o || "Choose…"}
                  </option>
                ))}
              </select>
              {!reviewed && (
                <p className="note">
                  Review the report first to triage it and set a next step.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <p className="note">
        Timers count from when a report was received. Limits are placeholders to
        be agreed with NEMA. Demo build.
      </p>
    </div>
  );
}
