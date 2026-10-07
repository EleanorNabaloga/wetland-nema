"use client";

import { useEffect, useMemo, useState } from "react";

const ISSUE_TYPES = [
  "Plastic waste",
  "Sewer spill",
  "Vegetation loss",
  "Wildlife distress",
  "Other",
];

function getLocationLabel(acc) {
  if (acc == null) return "GPS accuracy unavailable";
  if (acc <= 20) return "Good GPS precision";
  if (acc <= 50) return "Acceptable GPS precision";
  return "Weak GPS precision";
}

export default function Home() {
  const [type, setType] = useState("Plastic waste");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [acc, setAcc] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("geo-unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setAcc(String(pos.coords.accuracy));
      },
      () => setStatus("geo-unavailable"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  const locState = useMemo(() => {
    if (acc === "") return "weak";
    const value = Number(acc);
    if (!Number.isFinite(value)) return "weak";
    if (value <= 30) return "good";
    if (value <= 80) return "weak";
    return "bad";
  }, [acc]);

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lat || !lng) {
      setError("Please allow location access before sending the report.");
      return;
    }
    setError("");
    setStatus("sending");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo,
          type,
          note,
          lat: Number(lat),
          lng: Number(lng),
          acc: acc ? Number(acc) : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not send the report.");
        setStatus("idle");
        return;
      }
      setSubmittedId(data.id || "");
      setStatus("sent");
      setNote("");
      setPhoto("");
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <main className="app">
        <div className="bar">
          <span className="logo">Wetland Watch</span>
          <a className="link" href="/dashboard">
            NEMA dashboard
          </a>
        </div>
        <div className="reward" aria-live="polite">
          <h2>Report received</h2>
          <p>
            Thanks for your alert. NEMA will review this report and update you
            once a decision is made.
          </p>
          <div className="label">Case reference</div>
          <input value={submittedId} readOnly />
          <div className="note">
            Keep this reference if you need to follow up on the report.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="bar">
        <span className="logo">Wetland Watch</span>
        <a className="link" href="/login">
          Officer login
        </a>
      </div>

      <h1>Report pollution</h1>
      <p className="muted">
        Capture what you see in the wetland and share the location with NEMA.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="label">Photo</div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageChange}
        />
        {photo && (
          <img
            className="photo"
            src={photo}
            alt="Selected pollution evidence"
          />
        )}

        <div className="label">Type of issue</div>
        <div className="chips">
          {ISSUE_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={type === item}
              onClick={() => setType(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="loc" data-state={locState}>
          <div className="loc-t">Location</div>
          {lat && lng ? (
            <>
              <div className="loc-s">
                {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </div>
              <div className="loc-s">{getLocationLabel(Number(acc || 0))}</div>
            </>
          ) : (
            <div className="loc-s">Waiting for GPS…</div>
          )}
          <button
            type="button"
            className="ghost"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) => {
                setLat(String(pos.coords.latitude));
                setLng(String(pos.coords.longitude));
                setAcc(String(pos.coords.accuracy));
              })
            }
          >
            Refresh location
          </button>
        </div>

        <div className="label">What did you see?</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe the issue, any smells, runoff, blocked drains, debris, wildlife concerns, or anything you think NEMA should inspect."
        />

        {error && (
          <p
            role="alert"
            className="note"
            style={{ color: "#b00020", marginTop: 12 }}
          >
            {error}
          </p>
        )}
        {status === "geo-unavailable" && (
          <p className="note" style={{ marginTop: 12 }}>
            Location access is unavailable on this device. Please enable GPS or
            enter the location manually.
          </p>
        )}

        <button
          className="big"
          type="submit"
          disabled={status === "sending" || !lat || !lng}
        >
          {status === "sending" ? "Sending…" : "Send report"}
        </button>
      </form>
    </main>
  );
}
