export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "https://ilovej.store")
  .split(",")
  .map(o => o.trim());

// Bump when the privacy policy text changes, so each lead records which version
// they consented to.
const PRIVACY_POLICY_VERSION = "2026-06-22";

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
import { normalizePhone, isValidPhilippinePhone } from "@/lib/phone";
import {
  getCampaign,
  findLeadByPhone,
  createLead,
  assignVoucher,
  updateVoucherStatus,
  createSmsLog,
  updateSmsStatus,
  logEvent,
  getVoucherByLeadId,
} from "@/lib/db";
import { sendSms, buildVoucherMessage } from "@/lib/sms";

// Simple in-memory rate limiter (per IP, resets on process restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429, headers: cors }
    );
  }

  let body: {
    phone?: string;
    name?: string;
    email?: string;
    campaign_id?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    consent_voucher_sms?: boolean;
    consent_marketing?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400, headers: cors });
  }

  const {
    phone,
    name,
    email,
    campaign_id = "ilovej_meta_test",
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    consent_voucher_sms = false,
    consent_marketing = false,
  } = body;

  if (!phone) {
    return NextResponse.json({ success: false, error: "Mobile number is required" }, { status: 400, headers: cors });
  }

  if (!consent_voucher_sms) {
    return NextResponse.json(
      { success: false, error: "You must consent to receive the voucher by SMS" },
      { status: 400, headers: cors }
    );
  }

  if (!isValidPhilippinePhone(phone)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567)" },
      { status: 400, headers: cors }
    );
  }

  const phoneNormalized = normalizePhone(phone)!;

  const campaign = await getCampaign(campaign_id);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404, headers: cors });
  }

  if (campaign.status !== "active") {
    return NextResponse.json(
      { success: false, error: "This campaign has ended. Thank you for your interest!" },
      { status: 410, headers: cors }
    );
  }

  const now = new Date();
  if (campaign.end_date && new Date(campaign.end_date) < now) {
    return NextResponse.json(
      { success: false, error: "This campaign has ended. Thank you for your interest!" },
      { status: 410, headers: cors }
    );
  }

  const existingLead = await findLeadByPhone(campaign_id, phoneNormalized);
  if (existingLead) {
    const existingVoucher = await getVoucherByLeadId(existingLead.lead_id);
    return NextResponse.json(
      {
        success: false,
        already_claimed: true,
        voucher_status: existingVoucher?.status,
        error: "This mobile number has already claimed a voucher. Please check your SMS inbox.",
      },
      { status: 409, headers: cors }
    );
  }

  const lead = await createLead({
    campaign_id,
    name: name ?? null,
    phone_raw: phone,
    phone_normalized: phoneNormalized,
    email: email ?? null,
    meta_user_id: null,
    source: "shopify_page",
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
    utm_content: utm_content ?? null,
    utm_term: utm_term ?? null,
    consent_voucher_sms: consent_voucher_sms ? 1 : 0,
    consent_marketing: consent_marketing ? 1 : 0,
    consent_at: new Date().toISOString(),
    privacy_policy_version: PRIVACY_POLICY_VERSION,
    ip_address: ip,
    user_agent: req.headers.get("user-agent") ?? null,
  });

  await logEvent(campaign_id, "form_submitted", lead.lead_id, "shopify_page", {
    utm_source, utm_campaign,
  });

  // Voucher valid for 2 weeks (matches the "valid for 2 weeks" line in the SMS).
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const voucher = await assignVoucher(campaign_id, lead.lead_id, expiresAt);
  if (!voucher) {
    await logEvent(campaign_id, "voucher_sold_out", lead.lead_id, "system");
    return NextResponse.json(
      { success: false, error: "All vouchers have been claimed. Thank you for your interest!" },
      { status: 410, headers: cors }
    );
  }

  await logEvent(campaign_id, "voucher_assigned", lead.lead_id, "system", {
    voucher_id: voucher.voucher_id,
    discount_tier: voucher.discount_tier,
  });

  const message = buildVoucherMessage(voucher.discount_code, voucher.discount_tier);

  const smsLog = await createSmsLog({
    lead_id: lead.lead_id,
    voucher_id: voucher.voucher_id,
    phone: phoneNormalized,
    provider: process.env.SMS_PROVIDER ?? "mock",
    message_body: message,
    delivery_status: "pending",
    provider_message_id: null,
    failed_reason: null,
    admin_resend: 0,
  });

  const smsResult = await sendSms(phoneNormalized, message);

  if (smsResult.success) {
    await updateSmsStatus(smsLog.sms_id, "sent", smsResult.provider_message_id);
    await updateVoucherStatus(voucher.voucher_id, "sent");
    await logEvent(campaign_id, "sms_sent", lead.lead_id, "sms_provider", {
      sms_id: smsLog.sms_id,
      provider_message_id: smsResult.provider_message_id,
    });
  } else {
    await updateSmsStatus(smsLog.sms_id, "failed", undefined, smsResult.error);
    await updateVoucherStatus(voucher.voucher_id, "failed");
    await logEvent(campaign_id, "sms_failed", lead.lead_id, "sms_provider", {
      sms_id: smsLog.sms_id,
      error: smsResult.error,
    });
  }

  return NextResponse.json(
    {
      success: true,
      sms_sent: smsResult.success,
      message: smsResult.success
        ? "Voucher assigned and SMS sent."
        : "Voucher assigned but SMS delivery failed. Please contact support.",
      discount_tier: voucher.discount_tier,
      voucher_status: smsResult.success ? "sent" : "failed",
    },
    { headers: cors }
  );
}
