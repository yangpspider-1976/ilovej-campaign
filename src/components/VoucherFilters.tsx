"use client";

import { useRouter } from "next/navigation";

const TIERS = [30, 40, 50, 70, 90];
const STATUSES = ["available", "assigned", "sent", "failed", "used", "expired", "cancelled"];

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  border: "1px solid var(--border, #e3e3e3)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
  color: "var(--text, #1a1a1a)",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  marginRight: 6,
};

export default function VoucherFilters({
  tier,
  status,
}: {
  tier?: string;
  status?: string;
}) {
  const router = useRouter();

  function apply(next: { tier?: string; status?: string }) {
    const t = next.tier ?? tier ?? "";
    const s = next.status ?? status ?? "";
    const params = new URLSearchParams();
    if (t) params.set("tier", t);
    if (s) params.set("status", s);
    const qs = params.toString();
    router.push(qs ? `/admin/vouchers?${qs}` : "/admin/vouchers");
  }

  const hasFilter = !!tier || !!status;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={labelStyle}>Tier</span>
        <select
          value={tier ?? ""}
          onChange={e => apply({ tier: e.target.value })}
          style={selectStyle}
        >
          <option value="">All</option>
          {TIERS.map(t => (
            <option key={t} value={String(t)}>{t}% OFF</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={labelStyle}>Status</span>
        <select
          value={status ?? ""}
          onChange={e => apply({ status: e.target.value })}
          style={selectStyle}
        >
          <option value="">All</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {hasFilter && (
        <button
          onClick={() => router.push("/admin/vouchers")}
          style={{
            height: 36,
            padding: "0 12px",
            border: "1px solid var(--border, #e3e3e3)",
            borderRadius: 8,
            fontSize: 13,
            background: "#fff",
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
