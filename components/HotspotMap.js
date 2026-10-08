"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

const COLORS = { red: "#ef4444", orange: "#f59e0b", yellow: "#eab308" };

export default function HotspotMap({ hotspots }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(el.current, { scrollWheelZoom: false }).setView([1.37, 32.29], 7);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      layerRef.current.clearLayers();
      for (const h of hotspots) {
        const color = COLORS[h.level];
        const popup = document.createElement("div");
        popup.style.whiteSpace = "pre-line";
        popup.textContent =
          "#" + h.rank + " " + h.level.toUpperCase() + " - score " + h.score + "\n" +
          h.reportCount + " reports" +
          (h.reporterCount != null ? " from " + h.reporterCount + " reporters" : "") + "\n" +
          "Mostly " + h.topType.toLowerCase();
        L.circle([h.lat, h.lng], { radius: 300, color, fillColor: color, fillOpacity: 0.35, weight: 2 })
          .bindPopup(popup)
          .addTo(layerRef.current);
      }

      if (!fittedRef.current && hotspots.length) {
        const bounds = L.latLngBounds(hotspots.map((h) => [h.lat, h.lng]));
        mapRef.current.fitBounds(bounds.pad(0.5), { maxZoom: 16 });
        fittedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotspots]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        fittedRef.current = false;
      }
    },
    [],
  );

  return (
    <div
      ref={el}
      style={{
        height: 380,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        marginBottom: 16,
        overflow: "hidden",
      }}
    />
  );
}
