"use client";
import { useEffect, useState } from "react";

export default function HotspotList() {
  const [hotspots, setHotspots] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/hotspots", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load hotspots"))))
      .then((d) => setHotspots(d.hotspots || []))
      .catch((e) => setError(e.message));
  }, []);

  const box = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  };

  return (
    <section style={{ margin: "24px 0" }}>
      <h2 style={{ marginBottom: 4 }}>Hotspots</h2>
      <p style={{ opacity: 0.7, marginTop: 0, fontSize: 14 }}>
        Areas with the most reports (about 500 m grid). Poor GPS fixes are excluded.
      </p>

      {error && <p style={{ color: "#ff8a8a" }}>{error}</p>}
      {!error && hotspots === null && <p>Loading hotspots...</p>}
      {hotspots && hotspots.length === 0 && (
        <p>No hotspots yet. They appear when 2 or more reports fall in the same area.</p>
      )}

      {hotspots &&
        hotspots.map((h, i) => (
          <div key={`${h.lat},${h.lng}`} style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>#{i + 1} - {h.count} reports</strong>
              <span style={{ color: h.open > 0 ? "#ffd27a" : "#7fd8b0" }}>
                {h.open > 0 ? `${h.open} still new` : "All reviewed"}
              </span>
            </div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              {Number(h.lat).toFixed(4)}, {Number(h.lng).toFixed(4)} - last report{" "}
              {new Date(Number(h.latest)).toLocaleDateString()}
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>{h.ids.join(", ")}</div>
            <a
              href={`https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lng}#map=17/${h.lat}/${h.lng}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", marginTop: 8, color: "#7fd8f0" }}
            >
              View on map
            </a>
          </div>
        ))}
    </section>
  );
}