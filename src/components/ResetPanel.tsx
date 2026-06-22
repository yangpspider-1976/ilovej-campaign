"use client";

import { useState } from "react";

export default function ResetPanel() {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const armed = confirm === "RESET";

  async function handleReset() {
    if (!armed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, text: data.error || "Reset failed." });
      } else {
        setResult({ ok: true, text: data.message || "Campaign reset." });
        setConfirm("");
      }
    } catch {
      setResult({ ok: false, text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #f3c2c2",
        background: "#fffafa",
        borderRadius: 12,
        padding: 24,
        maxWidth: 560,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#b00020", margin: "0 0 6px" }}>
        Danger Zone — Reset Campaign
      </h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
        This permanently deletes <strong>all leads, vouchers, SMS logs, and events</strong>,
        then re-seeds a fresh 1,000-voucher inventory. This cannot be undone. Use it to
        clear test data before launch.
      </p>

      <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
        Type <strong>RESET</strong> to confirm:
      </label>
      <input
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        placeholder="RESET"
        style={{
          width: "100%",
          maxWidth: 220,
          boxSizing: "border-box",
          padding: "10px 12px",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          fontSize: 15,
          marginBottom: 14,
        }}
      />

      <div>
        <button
          onClick={handleReset}
          disabled={!armed || loading}
          style={{
            padding: "11px 20px",
            background: armed ? "#b00020" : "#e5e7eb",
            color: armed ? "#fff" : "#9ca3af",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: armed && !loading ? "pointer" : "default",
          }}
        >
          {loading ? "Resetting…" : "Reset campaign"}
        </button>
      </div>

      {result && (
        <p
          style={{
            marginTop: 14,
            fontSize: 14,
            fontWeight: 600,
            color: result.ok ? "#1a7a3a" : "#E02229",
          }}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
