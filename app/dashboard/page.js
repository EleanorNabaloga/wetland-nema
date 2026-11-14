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

function fmtCoord(val, digits = 4) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "N/A";
}

function mapUrl(r) {
  const lat = Number(r?.lat);
  const lng = Number(r?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const d = 0.0025;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}
// Time between the photo being taken and the report reaching NEMA. Only
// meaningful when the time came from the photo itself (gallery uploads, or
// reports queued offline); otherwise it is the send time and the gap is ~0.
const OLD_PHOTO_MS = 48 * 3600000;
function captureDelay(r) {
  const gap = Number(r.receivedAt) - Number(r.ts);
  return Number.isFinite(gap) && gap > 10 * 60000 ? gap : 0;
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
  const [trust, setTrust] = useState(null);
  const [trustTick, setTrustTick] = useState(0);

  const [showInspection, setShowInspection] = useState(false);
  const [inspCert, setInspCert] = useState("");
  const [inspLat, setInspLat] = useState("");
  const [inspLng, setInspLng] = useState("");
  const [inspPh, setInspPh] = useState("");
  const [inspClarity, setInspClarity] = useState("clear");
  const [inspOdor, setInspOdor] = useState("natural_earth");
  const [inspAction, setInspAction] = useState("no_violation_natural_runoff");
  const [inspSummary, setInspSummary] = useState("");
  const [inspForce, setInspForce] = useState(false);
  const [inspForceReason, setInspForceReason] = useState("");
  const [inspError, setInspError] = useState(null);
  const [inspSubmitting, setInspSubmitting] = useState(false);

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

  // Refresh every 30 seconds while the tab is visible, and right away when an
  // officer comes back to it, instead of re-downloading the list every 3 seconds.
  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const t = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
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

  async function submitInspection(id) {
    setInspError(null);
    if (!inspCert.trim()) {
      setInspError("Certificate Number is required.");
      return;
    }
    setInspSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${id}/inspection`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          certificateNumber: inspCert.trim(),
          lat: inspLat,
          lng: inspLng,
          waterPh: inspPh ? Number(inspPh) : null,
          waterClarity: inspClarity,
          odor: inspOdor,
          actionRecommended: inspAction,
          findingsSummary: inspSummary.trim() || null,
          force: inspForce,
          forceReason: inspForceReason.trim() || undefined,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        const d = await res.json().catch(() => ({}));
        setInspError(d.error || "Forbidden: Only authorized roles can submit inspections.");
        setInspSubmitting(false);
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setInspError(d.error || "Could not record inspection.");
        setInspSubmitting(false);
        return;
      }
      setShowInspection(false);
      setInspCert("");
      setInspForce(false);
      setInspForceReason("");
      load();
    } catch {
      setInspError("Could not connect to server.");
    } finally {
      setInspSubmitting(false);
    }
  }

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

  useEffect(() => {
    setTrust(null);
    if (!selId) return;
    let live = true;
    fetch("/api/trust?report=" + encodeURIComponent(selId), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live) setTrust(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [selId, sel && sel.status, sel && sel.category, trustTick]);

  return (
    <div className="dash">
      <header className="bar">
        <span className="logo">Kuuma Obutonde · NEMA dashboard</span>
        <span>
          <a className="link" href="/hotspots">Hotspots</a>{" "}
          · <a className="link" href="/help">Help</a>{" "}
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
                {(r.hasPhoto ?? Boolean(r.photo)) ? (
                  <img alt="" loading="lazy" src={`/api/reports/${encodeURIComponent(r.id)}/photo`} />
                ) : (
                  <span aria-hidden="true" style={{ width: 56, height: 56, flex: "none" }} />
                )}
                <span className="grow">
                  <span className="t">
                    {r.id} · {r.category || r.type || "Pollution"}
                  </span>
                  <br />
                  <span className="muted">
                    {fmtCoord(r.lat, 4)}, {fmtCoord(r.lng, 4)} · {ago(r.ts)}
                  </span>
                  <br />
                  <SlaBadge r={r} />
                  {r.aiCategory && !r.category && (
                    <>
                      {" "}
                      <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>
                        Suggested: {r.aiCategory}
                      </span>
                    </>
                  )}
                  {captureDelay(r) > OLD_PHOTO_MS && (
                    <>
                      {" "}
                      <span className="badge b-new" title="Photo taken more than 48 hours before it was sent">
                        Taken {fmtSpan(captureDelay(r))} before sending
                      </span>
                    </>
                  )}
                  {r.source === "upload" && (
                    <>
                      {" "}
                      <span className="badge b-bad" title="Photo chosen from the phone's gallery, not taken live in the app">
                        Gallery upload
                      </span>
                    </>
                  )}
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
              {(sel.hasPhoto ?? Boolean(sel.photo)) && (
                <img className="photo" alt="Evidence photo" src={`/api/reports/${encodeURIComponent(sel.id)}/photo`} />
              )}
              {mapUrl(sel) ? (
                <iframe
                  key={sel.id}
                  title="Map of where the photo was taken"
                  loading="lazy"
                  src={mapUrl(sel)}
                />
              ) : (
                <p className="muted" style={{ padding: 16 }}>Coordinates not available</p>
              )}
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
                  {fmtCoord(sel.lat, 6)}, {fmtCoord(sel.lng, 6)}
                </dd>
                <dt>GPS accuracy</dt>
                <dd>
                  {sel.acc == null
                    ? "Not available"
                    : `±${Math.round(sel.acc)} m`}
                </dd>
                <dt>Submitted via</dt>
                <dd>
                  {sel.source === "upload" ? (
                    <>
                      <span className="badge b-bad">Gallery upload</span>
                      <br />
                      <span className="muted">
                        Not taken live in the app. Check that the photo, its time
                        and its location belong to this report before acting.
                      </span>
                    </>
                  ) : sel.source === "camera" ? (
                    "Camera (taken live in the app)"
                  ) : (
                    sel.source || "Not stated"
                  )}
                </dd>
                <dt>Location source</dt>
                <dd>
                  {sel.locationSource === "photo"
                    ? "Read from the photo's saved GPS"
                    : sel.locationSource === "device"
                      ? "Phone GPS when sent"
                      : sel.locationSource || "Not stated"}
                </dd>
                <dt>Time source</dt>
                <dd>
                  {sel.timeSource === "photo"
                    ? "Read from the photo's saved time"
                    : sel.timeSource === "submitted"
                      ? "Time the report was sent"
                      : sel.timeSource || "Not stated"}
                </dd>
                <dt>Captured</dt>
                <dd>
                  {new Date(sel.ts).toLocaleString()}
                  {captureDelay(sel) > 0 && (
                    <>
                      <br />
                      <span className={captureDelay(sel) > OLD_PHOTO_MS ? "badge b-new" : "muted"}>
                        Taken {fmtSpan(captureDelay(sel))} before it was sent
                      </span>
                    </>
                  )}
                </dd>
                <dt>Received</dt>
                <dd>{when(sel.receivedAt)}</dd>
                <dt>Reviewed</dt>
                <dd>
                  {when(sel.viewedAt)}
                  {sel.reviewedBy ? " by " + sel.reviewedBy : ""}
                </dd>
                <dt>Sorted</dt>
                <dd>
                  {sel.category
                    ? sel.category + " · " + when(sel.triagedAt)
                    : "Not yet"}
                </dd>
                <dt>Inspected</dt>
                <dd>
                  {needsInspection ? (
                    <>
                      {when(sel.inspectedAt)}
                      {sel.inspectionForced && (
                        <span
                          className="badge b-warn"
                          style={{ marginLeft: 6 }}
                          title={sel.inspectionForceReason ? `Administrative override: ${sel.inspectionForceReason}` : "Location not verified"}
                        >
                          Location not verified
                        </span>
                      )}
                    </>
                  ) : sel.category ? (
                    "Not required"
                  ) : (
                    "Not yet"
                  )}
                </dd>
                <dt>Decided</dt>
                <dd>{when(sel.decidedAt)}</dd>
                <dt>Reporter trust</dt>
                <dd>
                  {trust
                    ? `${trust.level} (score ${trust.score}, ${trust.verifiedCount} verified)${trust.markedFalse ? " - marked false" : ""}`
                    : "Not available"}
                  {reviewed && trust && !trust.markedFalse && (
                    <button
                      type="button"
                      className="ghost"
                      style={{ marginLeft: 8 }}
                      onClick={async () => {
                        if (!confirm("Mark this report as false? This lowers the reporter's trust.")) return;
                        if (await patch(sel.id, { falseReport: true })) {
                          setTrustTick((n) => n + 1);
                          load();
                        }
                      }}
                    >
                      Mark as false report
                    </button>
                  )}
                </dd>
                <dt>Evidence hash</dt>
                <dd>
                  {sel.hash ? <code>{sel.hash.slice(0, 16)}…</code> : "Not provided"}
                </dd>
                <dt>Evidence signature</dt>
                <dd>
                  {sel.signatureStatus === "verified" ? (
                    <span className="badge b-ok">Verified on arrival</span>
                  ) : sel.signatureStatus === "unsigned" ? (
                    <span className="badge b-new">Not signed (older phone)</span>
                  ) : (
                    "Not recorded (sent before signature checks)"
                  )}
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

              {sel.aiCategory && (
                <div
                  style={{
                    background: "rgba(2, 132, 199, 0.08)",
                    border: "1px solid rgba(2, 132, 199, 0.25)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    margin: "12px 0",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0369a1" }}>
                    Helpful Suggestion: {sel.aiCategory}
                    {sel.aiConfidence != null && ` (${Math.round(sel.aiConfidence * 100)}% confidence)`}
                  </div>
                  {sel.aiReason && (
                    <div style={{ fontSize: "0.8125rem", color: "#475569", marginTop: 4 }}>
                      {sel.aiReason}
                    </div>
                  )}
                  {reviewed && !sel.category && (
                    <button
                      type="button"
                      className="ghost"
                      style={{ marginTop: 8, padding: "4px 10px", fontSize: "0.8125rem" }}
                      onClick={() => act(sel.id, { category: sel.aiCategory })}
                    >
                      Accept {sel.aiCategory}
                    </button>
                  )}
                </div>
              )}

              <label
                className="label"
                htmlFor="cat"
                style={{ display: "block" }}
              >
                Priority category
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
                <div style={{ margin: "12px 0" }}>
                  <button
                    type="button"
                    className="big"
                    style={{ minHeight: 48, width: "100%" }}
                    onClick={() => {
                      setInspLat(sel.lat != null ? String(sel.lat) : "");
                      setInspLng(sel.lng != null ? String(sel.lng) : "");
                      setInspError(null);
                      setShowInspection((v) => !v);
                    }}
                  >
                    {showInspection ? "Close inspection form" : "Record field inspection"}
                  </button>

                  {showInspection && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitInspection(sel.id);
                      }}
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                      }}
                    >
                      <h4 style={{ margin: "0 0 8px 0" }}>Section 107 Field Inspection</h4>
                      {inspError && (
                        <p role="alert" style={{ color: "#dc2626", fontSize: 13, margin: "0 0 8px 0" }}>
                          {inspError}
                        </p>
                      )}
                      <label className="label" style={{ display: "block", fontSize: 12 }}>
                        Certificate Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={inspCert}
                        placeholder="e.g. NEMA/SEC107/2026/0123"
                        onChange={(e) => setInspCert(e.target.value)}
                        style={{ width: "100%", padding: 6, marginBottom: 8 }}
                      />

                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ display: "block", fontSize: 12 }}>
                            On-site Lat *
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={inspLat}
                            onChange={(e) => setInspLat(e.target.value)}
                            style={{ width: "100%", padding: 6 }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ display: "block", fontSize: 12 }}>
                            On-site Lng *
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={inspLng}
                            onChange={(e) => setInspLng(e.target.value)}
                            style={{ width: "100%", padding: 6 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ display: "block", fontSize: 12 }}>
                            Water pH (0.0-14.0)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="14"
                            value={inspPh}
                            placeholder="7.0"
                            onChange={(e) => setInspPh(e.target.value)}
                            style={{ width: "100%", padding: 6 }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ display: "block", fontSize: 12 }}>
                            Water Clarity
                          </label>
                          <select
                            value={inspClarity}
                            onChange={(e) => setInspClarity(e.target.value)}
                            style={{ width: "100%", padding: 6 }}
                          >
                            <option value="clear">Clear</option>
                            <option value="murky_clay">Murky clay</option>
                            <option value="chemical_opaque">Chemical opaque</option>
                            <option value="oil_sheen">Oil sheen</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ display: "block", fontSize: 12 }}>
                            Odor
                          </label>
                          <select
                            value={inspOdor}
                            onChange={(e) => setInspOdor(e.target.value)}
                            style={{ width: "100%", padding: 6 }}
                          >
                            <option value="natural_earth">Natural earth</option>
                            <option value="raw_sewage">Raw sewage</option>
                            <option value="chemical_solvent">Chemical solvent</option>
                            <option value="burning">Burning</option>
                            <option value="none">None</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label" style={{ display: "block", fontSize: 12 }}>
                            Action Recommended
                          </label>
                          <select
                            value={inspAction}
                            onChange={(e) => setInspAction(e.target.value)}
                            style={{ width: "100%", padding: 6 }}
                          >
                            <option value="no_violation_natural_runoff">No violation (natural runoff)</option>
                            <option value="stop_notice">Stop notice</option>
                            <option value="restoration_order">Restoration order</option>
                            <option value="environmental_police_escort">Environmental police escort</option>
                            <option value="refer_to_local_council">Refer to local council</option>
                          </select>
                        </div>
                      </div>

                      <label className="label" style={{ display: "block", fontSize: 12 }}>
                        Findings Summary
                      </label>
                      <textarea
                        value={inspSummary}
                        placeholder="Detailed observations at the wetland..."
                        onChange={(e) => setInspSummary(e.target.value)}
                        rows={2}
                        style={{ width: "100%", padding: 6, marginBottom: 8 }}
                      />

                      <div style={{ padding: 6, background: "#fef3c7", borderRadius: 4, marginBottom: 8 }}>
                        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={inspForce}
                            onChange={(e) => setInspForce(e.target.checked)}
                          />
                          <b>Administrative override (GPS unavailable / remote swamp)</b>
                        </label>
                        {inspForce && (
                          <input
                            type="text"
                            placeholder="Reason for override (min 10 characters)..."
                            value={inspForceReason}
                            onChange={(e) => setInspForceReason(e.target.value)}
                            style={{ width: "100%", padding: 6, marginTop: 4, fontSize: 12 }}
                          />
                        )}
                      </div>

                      <button
                        type="submit"
                        className="big"
                        disabled={inspSubmitting}
                        style={{ width: "100%", minHeight: 40 }}
                      >
                        {inspSubmitting ? "Recording..." : "Save Field Inspection"}
                      </button>
                    </form>
                  )}
                </div>
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
                  Review the report first to sort it and set a next step.
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
