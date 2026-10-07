"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

const ROLES = ["reviewer", "inspector", "legal", "oversight"];

export default function StaffAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/staff", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) return router.push("/login");
      if (r.ok) setRows(await r.json());
    } catch {}
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(email, action) {
    setError("");
    const res = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action, role: roles[email] || "reviewer" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not save that change.");
    }
    load();
  }

  return (
    <div className="dash">
      <header className="bar">
        <span className="logo">Wetland Watch · Staff access</span>
        <LogoutButton />
      </header>
      <p className="note">Confirm each person with NEMA (phone or HR) before approving. Admins manage accounts only and cannot see reports.</p>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No staff accounts yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.email}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.status}</td>
                <td>
                  {r.role === "admin" ? "admin" : (
                    <select value={roles[r.email] || r.role} disabled={r.status === "active" || r.status === "rejected"} onChange={(e) => setRoles({ ...roles, [r.email]: e.target.value })}>
                      {ROLES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  {r.role !== "admin" && (r.status === "pending" || r.status === "disabled") && <button type="button" onClick={() => act(r.email, "approve")}>Approve</button>}{" "}
                  {r.role !== "admin" && r.status === "pending" && <button type="button" className="ghost" onClick={() => act(r.email, "reject")}>Reject</button>}
                  {r.role !== "admin" && r.status === "active" && <button type="button" className="ghost" onClick={() => act(r.email, "disable")}>Disable</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
