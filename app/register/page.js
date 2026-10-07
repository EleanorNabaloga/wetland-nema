"use client";

import { useState } from "react";
import Link from "next/link";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pending) return;
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), password }),
      });
      if (res.ok) { setDone(true); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not send your request.");
    } catch {
      setError("Could not reach the server. Check your connection.");
    }
    setPending(false);
  }

  if (done) {
    return (
      <div style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
        <h1>Request received</h1>
        <p>An administrator will review it. You can sign in once it is approved.</p>
        <Link className="link" href="/login">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
      <h1>Request access</h1>
      <p style={{ color: "#666" }}>For authorised NEMA officers. Use your official email. An administrator approves every request.</p>
      {error && <div role="alert" style={{ color: "#b00020", marginBottom: 12 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input aria-label="Full name" autoComplete="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" aria-label="Official email" autoComplete="username" placeholder="Official NEMA email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" aria-label="Password" autoComplete="new-password" placeholder="Password (12+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
        <input type="password" aria-label="Confirm password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <button type="submit" disabled={pending} style={{ padding: "10px 0", background: "#0b5c3b", color: "#fff", border: "none", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Sending…" : "Request access"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}><Link className="link" href="/login">Back to sign in</Link></p>
    </div>
  );
}
