export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getCampaignSummary, getTierCounts, listLeads, getCampaign } from "@/lib/db";

const CAMPAIGN_ID = "ilovej_meta_test";

function StatCard({
  value,
  label,
  icon,
  footer,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-main">
        <div className="stat-icon">{icon}</div>
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      </div>
      {footer && <div className="stat-footer">{footer}</div>}
    </div>
  );
}

function BadgeStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "status-muted",
    assigned: "status-warning",
    sent: "status-ok",
    failed: "status-danger",
    used: "status-ok",
    expired: "status-muted",
    cancelled: "status-muted",
  };
  return <span className={`badge ${map[status] ?? ""}`}>{status}</span>;
}

export default async function AdminDashboard() {
  const [summary, tierCounts, campaign, recentLeads] = await Promise.all([
    getCampaignSummary(CAMPAIGN_ID),
    getTierCounts(CAMPAIGN_ID),
    getCampaign(CAMPAIGN_ID),
    listLeads(CAMPAIGN_ID, 10, 0),
  ]);

  const conversionRate =
    summary.total_leads > 0
      ? ((summary.total_purchases / summary.total_leads) * 100).toFixed(1)
      : "0.0";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Campaign Dashboard</h1>
          <p>
            {campaign?.campaign_name} &bull;{" "}
            <span className={`badge ${campaign?.status === "active" ? "status-ok" : "status-muted"}`}>
              {campaign?.status}
            </span>
          </p>
        </div>
        <div className="actions">
          <a href="/api/admin/leads?format=csv" className="button secondary" style={{ fontSize: 13, height: 36, padding: "0 12px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Leads
          </a>
          <a href="/api/admin/vouchers?format=csv" className="button secondary" style={{ fontSize: 13, height: 36, padding: "0 12px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Vouchers
          </a>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 24 }}>
        <StatCard
          value={summary.total_leads}
          label="Total Leads"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          footer={<><span style={{ color: "var(--ok)", fontWeight: 600 }}>{summary.total_vouchers_assigned}</span> vouchers assigned</>}
        />
        <StatCard
          value={summary.total_sms_sent}
          label="SMS Sent"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          }
          footer={<><span style={{ color: "var(--danger)", fontWeight: 600 }}>{summary.total_sms_failed}</span> failed deliveries</>}
        />
        <StatCard
          value={summary.total_purchases}
          label="Purchases"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          }
          footer={<>₱{(summary.total_revenue ?? 0).toLocaleString()} total revenue</>}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, marginBottom: 24 }}>
        <div className="panel">
          <h2>Voucher Inventory by Tier</h2>
          <div className="table-wrap" style={{ boxShadow: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Discount</th>
                  <th>Available</th>
                  <th>Assigned</th>
                  <th>Sent</th>
                  <th>Used</th>
                  <th>Failed</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {tierCounts.map(tc => (
                  <tr key={tc.discount_tier}>
                    <td><span className="badge status-ok">{tc.discount_tier}% OFF</span></td>
                    <td>{tc.available}</td>
                    <td>{tc.assigned}</td>
                    <td>{tc.sent}</td>
                    <td style={{ color: "var(--ok)", fontWeight: 600 }}>{tc.used}</td>
                    <td style={{ color: tc.failed > 0 ? "var(--danger)" : undefined }}>{tc.failed}</td>
                    <td style={{ fontWeight: 600 }}>{tc.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Campaign KPIs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "Voucher Claim Rate", value: summary.total_vouchers_assigned > 0 ? `${((summary.total_vouchers_assigned / (summary.total_leads || 1)) * 100).toFixed(1)}%` : "—" },
              { label: "SMS Delivery Rate", value: summary.total_sms_sent > 0 ? `${((summary.total_sms_sent / (summary.total_vouchers_assigned || 1)) * 100).toFixed(1)}%` : "—" },
              { label: "Purchase Conversion", value: `${conversionRate}%` },
              { label: "Redemption Rate", value: `${summary.redemption_rate}%` },
              { label: "Vouchers Remaining", value: summary.vouchers_available.toLocaleString() },
              { label: "Total Revenue", value: `₱${(summary.total_revenue ?? 0).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Recent Leads</h2>
          <a href="/admin/leads" className="button secondary" style={{ fontSize: 13, height: 36, padding: "0 12px" }}>
            View All
          </a>
        </div>
        <div className="table-wrap" style={{ boxShadow: "none" }}>
          <div className="table-scroll" style={{ maxHeight: 420 }}>
            <table>
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Claimed</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: "32px 16px" }}>
                      No leads yet. Share your campaign link to get started.
                    </td>
                  </tr>
                ) : (
                  recentLeads.map(lead => (
                    <tr key={lead.lead_id} className="clickable-row">
                      <td style={{ fontFamily: "monospace", fontSize: 13 }}>
                        {lead.phone_normalized.slice(0, 5) + "***" + lead.phone_normalized.slice(-4)}
                      </td>
                      <td>{lead.name ?? <span className="inline-muted">—</span>}</td>
                      <td>
                        <BadgeStatus status={lead.utm_source ?? "direct"} />
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>
                        {new Date(lead.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
