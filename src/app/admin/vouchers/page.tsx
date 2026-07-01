export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listVouchers, getTierCounts } from "@/lib/db";
import { formatDateTimePH, formatDatePH } from "@/lib/datetime";
import VoucherFilters from "@/components/VoucherFilters";

const CAMPAIGN_ID = "ilovej_meta_test";

const VALID_TIERS = new Set([30, 40, 50, 60, 70, 80, 90]);
const VALID_STATUSES = new Set([
  "available", "assigned", "sent", "failed", "used", "expired", "cancelled",
]);

const STATUS_CLASS: Record<string, string> = {
  available: "status-muted",
  assigned: "status-warning",
  sent: "status-ok",
  failed: "status-danger",
  used: "status-ok",
  expired: "status-muted",
  cancelled: "status-muted",
};

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; status?: string }>;
}) {
  const sp = await searchParams;

  const tierNum = sp.tier ? parseInt(sp.tier, 10) : undefined;
  const tierFilter = tierNum != null && VALID_TIERS.has(tierNum) ? tierNum : undefined;
  const statusFilter = sp.status && VALID_STATUSES.has(sp.status) ? sp.status : undefined;
  const filtered = tierFilter != null || statusFilter != null;

  const [vouchers, tierCounts] = await Promise.all([
    listVouchers(CAMPAIGN_ID, 200, 0, { tier: tierFilter, status: statusFilter }),
    getTierCounts(CAMPAIGN_ID),
  ]);

  // Accurate campaign-wide totals (tierCounts aggregates ALL vouchers, not just
  // the 200-row page we load for the table).
  const totalAll = tierCounts.reduce((s, tc) => s + tc.total, 0);
  const availableAll = tierCounts.reduce((s, tc) => s + tc.available, 0);
  const assignedAll = totalAll - availableAll;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Vouchers</h1>
          <p>{assignedAll} assigned of {totalAll} total</p>
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

      <div className="stats" style={{ marginBottom: 20, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
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

      <VoucherFilters tier={sp.tier} status={sp.status} />

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
                    {filtered ? "No vouchers match this filter." : "No vouchers found."}
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
                      {formatDateTimePH(v.assigned_at)}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>
                      {formatDatePH(v.expires_at)}
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
          <span>
            {filtered
              ? `Showing ${vouchers.length}${vouchers.length === 200 ? "+" : ""} matching voucher${vouchers.length === 1 ? "" : "s"}`
              : `${vouchers.length}${vouchers.length === 200 ? "+" : ""} shown • ${assignedAll} assigned of ${totalAll}`}
          </span>
        </div>
      </div>
    </>
  );
}
