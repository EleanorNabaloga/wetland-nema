"use client";

import HotspotList from "../../components/HotspotList";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function safeNext(v) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//")
    ? v
    : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mfa === "none")
          router.push(data.role === "admin" ? "/admin/staff" : next);
        else router.push("/mfa?next=" + encodeURIComponent(next));
        router.refresh();
        return;
      }
      if (res.status === 429)
        setError("Too many attempts. Wait 15 minutes and try again.");
      else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.status === "pending"
            ? "Your access request is waiting for administrator approval."
            : "This account has no access. Contact your administrator.",
        );
      } else setError("Invalid officer credentials.");
    } catch {
      setError("Could not reach the server. Check your connection.");
    }
    setPending(false);
  }

  return (
    <div style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
      <h1>NEMA Officer Login</h1>
      <p style={{ color: "#666" }}>
        Sign in to access the compliance dashboard.
      </p>
      {error && (
        <div role="alert" style={{ color: "#b00020", marginBottom: 12 }}>
          {error}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input
          type="email"
          aria-label="Email"
          autoComplete="username"
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          aria-label="Password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "10px 0",
            background: "#0b5c3b",
            color: "#fff",
            border: "none",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        No account?{" "}
        <Link className="link" href="/register">
          Request access
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
