export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { listVouchers, getTierCounts } from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "changeme";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const campaignId = searchParams.get("campaign_id") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const format = searchParams.get("format");

  const [vouchers, tierCounts] = await Promise.all([
    listVouchers(campaignId, limit, offset),
    getTierCounts(campaignId ?? "ilovej_meta_test"),
  ]);

  if (format === "csv") {
    const rows = vouchers.map(v => [
      v.voucher_id,
      v.campaign_id,
      v.discount_tier,
      v.discount_code,
      v.status,
      v.assigned_at ?? "",
      v.expires_at ?? "",
      v.shopify_order_id ?? "",
      v.order_amount ?? "",
      v.created_at,
    ]);

    const csv = [
      ["voucher_id", "campaign_id", "discount_tier", "discount_code", "status", "assigned_at", "expires_at", "shopify_order_id", "order_amount", "created_at"].join(","),
      ...rows.map(r => r.map(v2 => `"${String(v2).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="vouchers-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ vouchers, tier_counts: tierCounts, count: vouchers.length });
}
