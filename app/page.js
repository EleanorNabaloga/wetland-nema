"use client";

import { useEffect, useMemo, useState } from "react";
import { LANGUAGES, translator, issueLabel, initialLanguage, saveLanguage } from "@/lib/i18n";

// Covers both wet and dry land: streets, slums, markets, wetlands, forests, rivers.
// Saved in English; labels are translated in lib/i18n.js.
const ISSUE_TYPES = [
  "Rubbish heap (kasasiro)",
  "Plastic waste",
  "Sewer spill",
  "Blocked drainage",
  "Open burning / smoke",
  "Industrial waste / chemicals",
  "Vegetation loss",
  "Wetland encroachment",
  "Wildlife distress",
  "Other",
];

function locationLabelKey(acc) {
  if (acc == null || !Number.isFinite(acc)) return "gpsNone";
  if (acc <= 20) return "gpsGood";
  if (acc <= 50) return "gpsOk";
  return "gpsWeak";
}

function LanguagePicker({ lang, onChange, label }) {
  return (
    <div className="langs" role="group" aria-label={label}>
      {LANGUAGES.map((l) => (
        <button key={l.code} type="button" lang={l.code} aria-pressed={lang === l.code} onClick={() => onChange(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState("en");
  const [type, setType] = useState(ISSUE_TYPES[0]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [acc, setAcc] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(""); // a text key, or a server message
  const [submittedId, setSubmittedId] = useState("");

  const t = useMemo(() => translator(lang), [lang]);

  useEffect(() => {
    setLang(initialLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function changeLanguage(code) {
    setLang(code);
    saveLanguage(code);
  }

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
      setError("needLocation");
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
        setError(data.error || "sendFailed");
        setStatus("idle");
        return;
      }
      setSubmittedId(data.id || "");
      setStatus("sent");
      setNote("");
      setPhoto("");
    } catch {
      setError("offline");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <main className="app">
        <div className="bar">
          <span className="logo">Kuuma Obutonde</span>
          <a className="link" href="/dashboard">
            {t("dashboard")}
          </a>
        </div>
        <LanguagePicker lang={lang} onChange={changeLanguage} label={t("language")} />
        <div className="reward" aria-live="polite">
          <h2>{t("received")}</h2>
          <p>{t("thanks")}</p>
          <div className="label">{t("caseRef")}</div>
          <input value={submittedId} readOnly />
          <div className="note">{t("keepRef")}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="bar">
        <span className="logo">Kuuma Obutonde</span>
        <a className="link" href="/login">
          {t("officerLogin")}
        </a>
      </div>
      <LanguagePicker lang={lang} onChange={changeLanguage} label={t("language")} />

      <h1>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>

      <form onSubmit={handleSubmit}>
        <div className="label">{t("photo")}</div>
        <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} />
        {photo && <img className="photo" src={photo} alt={t("photoAlt")} />}

        <div className="label">{t("issueType")}</div>
        <div className="chips">
          {ISSUE_TYPES.map((item) => (
            <button key={item} type="button" aria-pressed={type === item} onClick={() => setType(item)}>
              {issueLabel(item, lang)}
            </button>
          ))}
        </div>

        <div className="loc" data-state={locState}>
          <div className="loc-t">{t("location")}</div>
          {lat && lng ? (
            <>
              <div className="loc-s">
                {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </div>
              <div className="loc-s">{t(locationLabelKey(acc === "" ? null : Number(acc)))}</div>
            </>
          ) : (
            <div className="loc-s">{t("waitingGps")}</div>
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
            {t("refresh")}
          </button>
        </div>

        <div className="label">{t("whatSaw")}</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />

        {error && (
          <p role="alert" className="note" style={{ color: "#b00020", marginTop: 12 }}>
            {t(error)}
          </p>
        )}
        {status === "geo-unavailable" && (
          <p className="note" style={{ marginTop: 12 }}>
            {t("geoUnavailable")}
          </p>
        )}

        <button className="big" type="submit" disabled={status === "sending" || !lat || !lng}>
          {status === "sending" ? t("sending") : t("send")}
        </button>
      </form>
    </main>
  );
}
