"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeNext(v) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

function Mfa() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/auth/mfa", { cache: "no-store" });
      if (r.status === 401) return router.push("/login");
      if (r.ok) setInfo(await r.json());
      else setError("Could not start verification.");
    })();
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const d = await res.json();
        router.push(d.role === "admin" ? "/admin/staff" : next);
        router.refresh();
        return;
      }
      if (res.status === 401 && (await res.clone().json().catch(() => ({}))).error !== "Invalid code") return router.push("/login");
      const d = await res.json().catch(() => ({}));
      setError(d.error || "That code did not work.");
    } catch {
      setError("Could not reach the server. Check your connection.");
    }
    setPending(false);
  }

  if (!info) return <div style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>{error || "Loading…"}</div>;

  return (
    <div style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
      <h1>{info.mode === "setup" ? "Set up two-step sign-in" : "Enter your code"}</h1>
      {info.mode === "setup" ? (
        <>
          <p style={{ color: "#666" }}>Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator), then enter the 6-digit code it shows.</p>
          <img src={info.qr} alt="QR code for your authenticator app" width={220} height={220} style={{ background: "#fff", display: "block", margin: "12px 0" }} />
          <p className="note">Can&apos;t scan? Enter this key by hand: <code>{info.secret}</code></p>
        </>
      ) : (
        <p style={{ color: "#666" }}>Open your authenticator app and enter the 6-digit code for NEMA Wetland Watch.</p>
      )}
      {error && <div role="alert" style={{ color: "#b00020", marginBottom: 12 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input inputMode="numeric" autoComplete="one-time-code" aria-label="6-digit code" placeholder="123456" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} required />
        <button type="submit" disabled={pending} style={{ padding: "10px 0", background: "#0b5c3b", color: "#fff", border: "none", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Checking…" : info.mode === "setup" ? "Confirm and sign in" : "Verify"}
        </button>
      </form>
    </div>
  );
}

export default function MfaPage() {
  return <Suspense fallback={null}><Mfa /></Suspense>;
}
