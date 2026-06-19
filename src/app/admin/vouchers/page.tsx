export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listVouchers, getTierCounts } from "@/lib/db";

const CAMPAIGN_ID = "ilovej_meta_test";

const STATUS_CLASS: Record<string, string> = {
  available: "status-muted",
  assigned: "status-warning",
  sent: "status-ok",
  failed: "status-danger",
  used: "status-ok",
  expired: "status-muted",
  cancelled: "status-muted",
};

export default async function VouchersPage() {
  const [vouchers, tierCounts] = await Promise.all([
    listVouchers(CAMPAIGN_ID, 200, 0),
    getTierCounts(CAMPAIGN_ID),
  ]);
  const assigned = vouchers.filter(v => v.status !== "available");

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Vouchers</h1>
          <p>{assigned.length} assigned of {vouchers.length} total</p>
        </div>
        <div className="actions">
          <a
            href={`/api/admin/vouchers?campaign_id=${CAMPAIGN_ID}&format=csv`}
            className="button secondary"
            style={{ fontSize: 13, height: 36, padding: "0 12px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </a>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 20, gridTemplateColumns: "repeat(5, minmax(140px, 1fr))" }}>
        {tierCounts.map(tc => (
          <div key={tc.discount_tier} className="panel" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>
              {tc.discount_tier}%
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>OFF</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Available: </span>
                <strong>{tc.available}</strong>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Used: </span>
                <strong style={{ color: "var(--ok)" }}>{tc.used}</strong>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Sent: </span>
                <strong>{tc.sent}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-scroll" style={{ maxHeight: 640 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Assigned At</th>
                <th>Expires At</th>
                <th>Order ID</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "40px 16px" }}>
                    No vouchers found.
                  </td>
                </tr>
              ) : (
                vouchers.map(v => (
                  <tr key={v.voucher_id} className={v.status === "used" ? "selected-row" : ""}>
                    <td style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>
                      {v.discount_code}
                    </td>
                    <td>
                      <span className="badge status-ok">{v.discount_tier}%</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[v.status] ?? ""}`}>{v.status}</span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>
                      {v.assigned_at
                        ? new Date(v.assigned_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>
                      {v.expires_at
                        ? new Date(v.expires_at).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>
                      {v.shopify_order_id ?? "—"}
                    </td>
                    <td style={{ fontWeight: v.order_amount ? 600 : 400, color: v.order_amount ? "var(--ok)" : "var(--muted)" }}>
                      {v.order_amount != null ? `₱${v.order_amount.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>{vouchers.length} vouchers &bull; {assigned.length} assigned</span>
        </div>
      </div>
    </>
  );
}
