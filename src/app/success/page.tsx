"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const tier = searchParams.get("tier");
  const smsFailed = searchParams.get("sms_failed") === "1";
  const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL ?? "#";

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
          {/* Success checkmark */}
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
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1>Voucher Sent!</h1>
          <p>
            {smsFailed
              ? "Your voucher has been assigned. Please contact support to receive your code."
              : "Your iLoveJ voucher has been sent by SMS. Please check your phone."}
          </p>
        </div>

        <div className="claim-card-body">
          {tier && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "#e6f6f2",
              border: "1px solid #99d8ca",
              borderRadius: 8,
              padding: "16px 20px",
              marginBottom: 20,
              textAlign: "center",
            }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>
                  {tier}% OFF
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  Your assigned discount
                </div>
              </div>
            </div>
          )}

          {smsFailed ? (
            <div className="notice warning" style={{ marginBottom: 16 }}>
              We could not deliver your SMS. Please contact our support team via Facebook Messenger with your
              registered mobile number so we can send your voucher code manually.
            </div>
          ) : (
            <div className="notice" style={{ marginBottom: 16 }}>
              Your discount code has been sent to your mobile number by SMS. The code is valid for
              72 hours and can only be used once.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href={shopifyUrl}
              className="button large"
              style={{ textAlign: "center", display: "flex" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              Shop at iLoveJ Store
            </a>

            <a
              href="/voucher/ilovej"
              className="button secondary"
              style={{ textAlign: "center", display: "flex" }}
            >
              Back to Claim Page
            </a>
          </div>

          <div style={{ marginTop: 24, padding: "16px", background: "#f8fafc", borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "var(--ink)" }}>How to use your voucher:</strong><br/>
              Enter the discount code at checkout on our Shopify store. The code is one-time use only
              and valid until the expiry date shown in your SMS. Minimum purchase amount may apply.
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

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="claim-page">
        <div className="loading-modal" style={{ marginTop: 80 }}>
          <div className="loading-spinner" />
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
