export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getLeadById, getVoucherByLeadId, createSmsLog, updateSmsStatus, updateVoucherStatus, logEvent } from "@/lib/db";
import { sendSms, buildVoucherMessage } from "@/lib/sms";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "changeme";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { lead_id } = await req.json() as { lead_id?: string };
  if (!lead_id) {
    return NextResponse.json({ success: false, error: "lead_id required" }, { status: 400 });
  }

  const lead = await getLeadById(lead_id);
  if (!lead) {
    return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
  }

  const voucher = await getVoucherByLeadId(lead_id);
  if (!voucher) {
    return NextResponse.json({ success: false, error: "No voucher assigned to this lead" }, { status: 404 });
  }

  const message = buildVoucherMessage(voucher.discount_code, voucher.discount_tier);

  const smsLog = await createSmsLog({
    lead_id,
    voucher_id: voucher.voucher_id,
    phone: lead.phone_normalized,
    provider: process.env.SMS_PROVIDER ?? "mock",
    message_body: message,
    delivery_status: "pending",
    provider_message_id: null,
    failed_reason: null,
    admin_resend: 1,
  });

  const result = await sendSms(lead.phone_normalized, message);

  if (result.success) {
    await updateSmsStatus(smsLog.sms_id, "sent", result.provider_message_id);
    await updateVoucherStatus(voucher.voucher_id, "sent");
    await logEvent(lead.campaign_id, "sms_resent", lead_id, "admin", { sms_id: smsLog.sms_id });
  } else {
    await updateSmsStatus(smsLog.sms_id, "failed", undefined, result.error);
  }

  return NextResponse.json({
    success: result.success,
    message: result.success ? "SMS resent successfully" : "SMS resend failed",
    error: result.error,
  });
}
