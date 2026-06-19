import Link from "next/link";

export default function AlreadyClaimedPage() {
  return (
    <div className="claim-page">
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "white",
          boxShadow: "var(--paper-edge)",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--accent)",
          letterSpacing: "-1px",
        }}>
          iJ
        </div>
      </div>

      <div className="claim-card">
        <div className="claim-card-header" style={{ textAlign: "center" }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1>Already Claimed</h1>
          <p>This mobile number has already claimed a voucher.</p>
        </div>

        <div className="claim-card-body">
          <div className="notice" style={{ marginBottom: 16 }}>
            Please check your SMS inbox for your discount code. If you did not receive it, contact our support team.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href={process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL ?? "#"}
              className="button large"
              style={{ textAlign: "center", display: "flex" }}
            >
              Shop at iLoveJ Store
            </a>
            <Link href="/voucher/ilovej" className="button secondary" style={{ textAlign: "center", display: "flex" }}>
              Back to Claim Page
            </Link>
          </div>

          <div style={{ marginTop: 24, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "var(--ink)" }}>Did not receive your SMS?</strong><br />
              Hi! Please check if the mobile number you entered is correct. If you still did not receive the SMS,
              kindly message us via Facebook with your registered mobile number so we can check your voucher status.
            </p>
          </div>

          <p className="field-note" style={{ textAlign: "center", marginTop: 16 }}>
            Need help? Message us on{" "}
            <a href="https://www.facebook.com/ilovej" style={{ color: "var(--accent)", textDecoration: "underline" }}>Facebook</a>
          </p>
        </div>
      </div>
    </div>
  );
}
