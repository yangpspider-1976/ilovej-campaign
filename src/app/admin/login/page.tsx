"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      // Redirect to the originally requested page, or the dashboard.
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/admin") ? next : "/admin";
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 28,
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          <span style={{ color: "var(--accent)" }}>iLoveJ</span> Admin
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
          Enter the admin password to continue.
        </p>

        <input
          type="password"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder="Admin password"
          autoFocus
          autoComplete="current-password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "11px 14px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 15,
            marginBottom: 12,
          }}
        />

        {error && (
          <p style={{ color: "#E02229", fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !secret}
          style={{
            width: "100%",
            padding: 12,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || !secret ? "default" : "pointer",
            opacity: loading || !secret ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
