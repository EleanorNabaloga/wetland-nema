"use client";
import { useCallback, useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";
import { STAGE_LABEL, fmtSpan } from "@/lib/sla";

const cardStyle = {
  background: "var(--card)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--r)",
  padding: "1rem",
  marginBottom: "1rem",
};

const OVERDUE = { background: "var(--bad-bg)", color: "var(--bad)" };

export default function DailyBriefing() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [copiedId, setCopiedId] = useState(null);
  const [lang, setLang] = useState("en");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setState("signin");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = await res.json();
      setData(json);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const t = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const copyDraft = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const summary = data?.summary || {};
  const newUrgent = data?.newUrgent || [];
  const deadlineNudges = data?.deadlineNudges || [];
  const worsenedHotspots = data?.worsenedHotspots || [];
  const pendingStaff = data?.pendingStaff || [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.2rem" }}>
      <header className="bar">
        <span className="logo">Kuuma Obutonde · NEMA briefing</span>
        <span>
          <a className="link" href="/dashboard">Dashboard</a> ·{" "}
          <a className="link" href="/hotspots">Hotspots</a> ·{" "}
          <a className="link" href="/help">Help</a> · <LogoutButton />
        </span>
      </header>

      <div style={{ margin: "1rem 0" }}>
        <h1 style={{ margin: "0 0 0.3rem" }}>Daily Managerial Briefing</h1>
        <p className="muted">
          Automated morning overview for environmental managers and officers. Review urgent
          matters, pending deadlines, and suggested response drafts.
        </p>
      </div>

      {state === "loading" && <p className="muted">Loading morning briefing...</p>}
      {state === "signin" && (
        <p className="note">
          Please <a className="link" href="/login?next=/briefing">sign in</a> to view the briefing.
        </p>
      )}
      {state === "error" && (
        <p className="alert-error" role="alert">
          Could not load the morning briefing. Please try again.
        </p>
      )}

      {state === "ready" && (
        <>
          {/* Summary KPI Cards */}
          <div className="stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.8rem", margin: "1.2rem 0" }}>
            <div className="stat" style={cardStyle}>
              <b style={{ fontSize: "1.6rem", display: "block" }}>{summary.urgentCount || 0}</b>
              <span className="muted">New Urgent</span>
            </div>
            <div className="stat" style={cardStyle}>
              <b style={{ fontSize: "1.6rem", display: "block", color: summary.overdueCount > 0 ? "var(--bad)" : "inherit" }}>
                {summary.nudgeCount || 0}
              </b>
              <span className="muted">Impending (≤48h)</span>
            </div>
            <div className="stat" style={cardStyle}>
              <b style={{ fontSize: "1.6rem", display: "block", color: summary.overdueCount > 0 ? "var(--bad)" : "inherit" }}>
                {summary.overdueCount || 0}
              </b>
              <span className="muted">Overdue</span>
            </div>
            <div className="stat" style={cardStyle}>
              <b style={{ fontSize: "1.6rem", display: "block" }}>{summary.worsenedHotspotCount || 0}</b>
              <span className="muted">Active Hotspots</span>
            </div>
            {summary.pendingStaffCount > 0 && (
              <div className="stat" style={{ ...cardStyle, borderColor: "var(--warn)" }}>
                <b style={{ fontSize: "1.6rem", display: "block", color: "var(--warn)" }}>
                  {summary.pendingStaffCount}
                </b>
                <span className="muted">Pending Staff</span>
              </div>
            )}
          </div>

          {/* Pending Staff Banner */}
          {pendingStaff.length > 0 && (
            <div style={{ ...cardStyle, borderLeft: "4px solid var(--warn)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.2rem", fontSize: "1rem" }}>
                    Staff Access Requests ({pendingStaff.length})
                  </h3>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    New staff registrations are pending administrator review.
                  </p>
                </div>
                <a className="ghost" href="/admin/staff" style={{ textDecoration: "none" }}>
                  Manage Staff
                </a>
              </div>
            </div>
          )}

          {/* Controls: Language toggle for drafts */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "1.5rem 0 0.8rem" }}>
            <h2 style={{ margin: 0 }}>Impending Deadline Nudges ({deadlineNudges.length})</h2>
            <div className="chips" role="group" aria-label="Draft Language">
              <button
                type="button"
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
              >
                English Drafts
              </button>
              <button
                type="button"
                aria-pressed={lang === "lg"}
                onClick={() => setLang("lg")}
              >
                Luganda Drafts
              </button>
            </div>
          </div>

          {deadlineNudges.length === 0 ? (
            <div style={cardStyle}>
              <p className="muted">No reports are overdue or due within the next 48 hours.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {deadlineNudges.map((item, idx) => {
                const rep = item.report || item;
                const sla = item.sla || {};
                const sev = rep.aiSeverity || rep.severity || "Medium";
                const isOverdue = sla.overdue;
                const draft = lang === "lg" ? item.draftMessageLg : item.draftMessageEn;
                const itemId = rep.id || String(idx);

                return (
                  <div key={itemId} style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                          <span
                            className="badge"
                            style={
                              sev === "Critical"
                                ? { background: "var(--bad-bg)", color: "var(--bad)" }
                                : sev === "High"
                                ? { background: "var(--warn-bg)", color: "var(--warn)" }
                                : { background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)" }
                            }
                          >
                            {sev}
                          </span>
                          <b>{rep.type || rep.threatType || "Incident"}</b>
                          {rep.id && (
                            <a className="link" href={`/dashboard?report=${encodeURIComponent(rep.id)}`} style={{ fontSize: "0.85rem" }}>
                              View Report
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                          Stage: <b>{STAGE_LABEL[sla.stage] || sla.stage}</b> ·{" "}
                          <span style={isOverdue ? OVERDUE : undefined}>
                            {isOverdue ? `Overdue by ${fmtSpan(sla.left)}` : `Due in ${fmtSpan(sla.left)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Officer Draft Template Box */}
                    {draft && (
                      <div className="ai-box" style={{ marginTop: "0.8rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="ai-title">Suggested Reporter Update ({lang === "lg" ? "Luganda" : "English"})</span>
                          <button
                            type="button"
                            className="ghost"
                            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => copyDraft(itemId, draft)}
                          >
                            {copiedId === itemId ? "Copied!" : "Copy Draft"}
                          </button>
                        </div>
                        <p className="ai-reason" style={{ marginTop: "0.3rem", fontStyle: "italic" }}>
                          "{draft}"
                        </p>
                        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.3rem" }}>
                          The system never auto-sends messages. Officers review, edit, and send updates.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* New Critical & High Reports */}
          <h2 style={{ margin: "2rem 0 0.8rem" }}>New Urgent Reports ({newUrgent.length})</h2>
          {newUrgent.length === 0 ? (
            <div style={cardStyle}>
              <p className="muted">No new unreviewed Critical or High reports.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {newUrgent.map((rep, idx) => {
                const sev = rep.aiSeverity || rep.severity || "High";
                const draft = lang === "lg" ? rep.draftMessageLg : rep.draftMessageEn;
                const repId = rep.id || String(idx);

                return (
                  <div key={repId} style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          className="badge"
                          style={
                            sev === "Critical"
                              ? { background: "var(--bad-bg)", color: "var(--bad)" }
                              : { background: "var(--warn-bg)", color: "var(--warn)" }
                          }
                        >
                          {sev}
                        </span>
                        <b>{rep.type || rep.threatType || "Incident"}</b>
                      </div>
                      {rep.id && (
                        <a className="link" href={`/dashboard?report=${encodeURIComponent(rep.id)}`}>
                          Open Report
                        </a>
                      )}
                    </div>
                    {draft && (
                      <div className="ai-box" style={{ marginTop: "0.6rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="ai-title">Acknowledgement Draft</span>
                          <button
                            type="button"
                            className="ghost"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => copyDraft(repId, draft)}
                          >
                            {copiedId === repId ? "Copied!" : "Copy Draft"}
                          </button>
                        </div>
                        <p className="ai-reason" style={{ marginTop: "0.2rem" }}>
                          "{draft}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Hotspots Summary */}
          <h2 style={{ margin: "2rem 0 0.8rem" }}>Active & Worsening Hotspots ({worsenedHotspots.length})</h2>
          {worsenedHotspots.length === 0 ? (
            <div style={cardStyle}>
              <p className="muted">No active hotspots have worsened or triggered critical alerts.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {worsenedHotspots.map((h, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <b style={{ color: "var(--ink)" }}>{h.name || `Hotspot #${i + 1}`}</b>
                      <span className="muted" style={{ marginLeft: "0.6rem", fontSize: "0.85rem" }}>
                        {h.reportCount} reports ({h.trend || "active"})
                      </span>
                    </div>
                    <a className="link" href="/hotspots">
                      View Hotspot Map
                    </a>
                  </div>
                  {h.summary && (
                    <p style={{ fontSize: "0.85rem", color: "var(--ink)", marginTop: "0.4rem" }}>
                      {h.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
