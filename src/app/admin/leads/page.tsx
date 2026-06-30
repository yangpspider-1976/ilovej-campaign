export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listLeads, getVoucherByLeadId, type Voucher } from "@/lib/db";
import { maskPhone } from "@/lib/phone";
import { formatDateTimePH } from "@/lib/datetime";

const CAMPAIGN_ID = "ilovej_meta_test";

function VoucherBadge({ voucher }: { voucher: Voucher | undefined }) {
  if (!voucher) return <span className="badge status-muted">no voucher</span>;

  const map: Record<string, string> = {
    available: "status-muted",
    assigned: "status-warning",
    sent: "status-ok",
    failed: "status-danger",
    used: "status-ok",
    expired: "status-muted",
  };

  return (
    <span className={`badge ${map[voucher.status] ?? ""}`}>
      {voucher.discount_tier}% — {voucher.status}
    </span>
  );
}

export default async function LeadsPage() {
  const leads = await listLeads(CAMPAIGN_ID, 200, 0);
  const vouchers = await Promise.all(leads.map(l => getVoucherByLeadId(l.lead_id)));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Leads</h1>
          <p>{leads.length} total leads</p>
        </div>
        <div className="actions">
          <a
            href={`/api/admin/leads?campaign_id=${CAMPAIGN_ID}&format=csv`}
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

      <div className="table-wrap">
        <div className="table-scroll" style={{ maxHeight: 720 }}>
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Name</th>
                <th>Email</th>
                <th>Voucher</th>
                <th>Voucher Code</th>
                <th>UTM Source</th>
                <th>UTM Campaign</th>
                <th>Claimed At</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "40px 16px" }}>
                    No leads yet.
                  </td>
                </tr>
              ) : (
                leads.map((lead, i) => (
                  <tr key={lead.lead_id} className="clickable-row">
                    <td style={{ fontFamily: "monospace", fontSize: 13 }}>
                      {maskPhone(lead.phone_normalized)}
                    </td>
                    <td>{lead.name ?? <span className="inline-muted">—</span>}</td>
                    <td style={{ fontSize: 13 }}>{lead.email ?? <span className="inline-muted">—</span>}</td>
                    <td><VoucherBadge voucher={vouchers[i]} /></td>
                    <td style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>
                      {vouchers[i]?.discount_code ?? <span className="inline-muted">—</span>}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{lead.utm_source ?? "—"}</td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{lead.utm_campaign ?? "—"}</td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>
                      {formatDateTimePH(lead.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>{leads.length} leads</span>
        </div>
      </div>
    </>
  );
}
