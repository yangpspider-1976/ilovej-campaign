export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, maskPhone } from "@/lib/phone";
import { findLeadByPhone, getVoucherByLeadId } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const phone = searchParams.get("phone");
  const campaignId = searchParams.get("campaign_id") ?? "ilovej_meta_test";

  if (!phone) {
    return NextResponse.json({ success: false, error: "Phone required" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return NextResponse.json({ success: false, error: "Invalid phone number" }, { status: 400 });
  }

  const lead = await findLeadByPhone(campaignId, normalized);
  if (!lead) {
    return NextResponse.json({ success: false, found: false, message: "No claim found for this number" });
  }

  const voucher = await getVoucherByLeadId(lead.lead_id);

  return NextResponse.json({
    success: true,
    found: true,
    phone_masked: maskPhone(normalized),
    voucher_status: voucher?.status ?? "not_assigned",
    discount_tier: voucher?.discount_tier ?? null,
    expires_at: voucher?.expires_at ?? null,
  });
}
