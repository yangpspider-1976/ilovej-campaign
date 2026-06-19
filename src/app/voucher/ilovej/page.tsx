"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ClaimForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consentSms, setConsentSms] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!consentSms) {
      setError("Please agree to receive your voucher by SMS to continue.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/voucher/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: name || undefined,
          email: email || undefined,
          campaign_id: "ilovej_meta_test",
          utm_source: searchParams.get("utm_source") ?? "meta",
          utm_medium: searchParams.get("utm_medium") ?? undefined,
          utm_campaign: searchParams.get("utm_campaign") ?? undefined,
          utm_content: searchParams.get("utm_content") ?? undefined,
          utm_term: searchParams.get("utm_term") ?? undefined,
          consent_voucher_sms: consentSms,
          consent_marketing: consentMarketing,
        }),
      });

      const data = await res.json() as {
        success: boolean;
        already_claimed?: boolean;
        error?: string;
        sms_sent?: boolean;
        discount_tier?: number;
      };

      if (data.already_claimed) {
        router.push("/already-claimed");
        return;
      }

      if (!data.success) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const params = new URLSearchParams();
      if (data.discount_tier) params.set("tier", String(data.discount_tier));
      if (!data.sms_sent) params.set("sms_failed", "1");
      router.push(`/success?${params.toString()}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="claim-page">
      {/* Logo area */}
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
        {/* Header */}
        <div className="claim-card-header">
          <h1>Claim Your iLoveJ Voucher</h1>
          <p>Enter your mobile number to receive a limited discount voucher by SMS.</p>
        </div>

        {/* Body */}
        <div className="claim-card-body">
          {/* Voucher range badge */}
          <div className="voucher-range">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12"/>
              <rect x="2" y="7" width="20" height="5"/>
              <line x1="12" y1="22" x2="12" y2="7"/>
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
            </svg>
            You may receive 30% to 90% off — Limited vouchers only
          </div>

          {error && (
            <div className="notice warning" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label>
                Mobile Number <span style={{ color: "var(--danger)" }}>*</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="09171234567 or +639171234567"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                />
                <span className="field-note">Philippine mobile numbers only (Globe, Smart, DITO)</span>
              </label>
            </div>

            <div className="field-group" style={{ marginTop: 14 }}>
              <label>
                Name <span className="inline-muted">(optional)</span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            </div>

            <div className="field-group" style={{ marginTop: 14 }}>
              <label>
                Email <span className="inline-muted">(optional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </label>
            </div>

            {/* Consent */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="consent-row">
                <input
                  type="checkbox"
                  id="consent-sms"
                  checked={consentSms}
                  onChange={e => setConsentSms(e.target.checked)}
                  required
                />
                <label htmlFor="consent-sms">
                  I agree to receive my iLoveJ voucher and campaign-related confirmation by SMS. <span style={{ color: "var(--danger)" }}>*</span>
                </label>
              </div>

              <div className="consent-row">
                <input
                  type="checkbox"
                  id="consent-marketing"
                  checked={consentMarketing}
                  onChange={e => setConsentMarketing(e.target.checked)}
                />
                <label htmlFor="consent-marketing">
                  I agree to receive future promotional offers from iLoveJ by SMS or other channels. (optional)
                </label>
              </div>
            </div>

            {/* Privacy notice */}
            <p className="field-note" style={{ marginTop: 12, lineHeight: "1.5" }}>
              Your mobile number will be used to issue and deliver your voucher, prevent duplicate claims,
              and track campaign performance. Your information will be processed according to our{" "}
              <a href="/privacy" style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>

            <button
              type="submit"
              className="button large"
              disabled={loading}
              style={{ width: "100%", marginTop: 20 }}
            >
              {loading ? "Processing…" : "Claim My Voucher"}
            </button>
          </form>

          <p className="field-note" style={{ textAlign: "center", marginTop: 16 }}>
            One voucher per customer &bull; Limited quantities only &bull;{" "}
            <a href="/terms" style={{ color: "var(--accent)", textDecoration: "underline" }}>Terms apply</a>
          </p>
        </div>
      </div>

      {loading && (
        <div className="loading-backdrop">
          <div className="loading-modal">
            <div className="loading-spinner" />
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>Assigning your voucher…</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoucherClaimPage() {
  return (
    <Suspense fallback={
      <div className="claim-page">
        <div className="loading-modal" style={{ marginTop: 80 }}>
          <div className="loading-spinner" />
        </div>
      </div>
    }>
      <ClaimForm />
    </Suspense>
  );
}
