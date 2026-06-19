export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getVoucherByCode, markVoucherUsed, logEvent } from "@/lib/db";

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";

function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET) return true;
  const digest = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  total_price: string;
  email?: string;
  phone?: string;
  discount_codes: Array<{ code: string; amount: string; type: string }>;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";

  if (SHOPIFY_WEBHOOK_SECRET && !verifyShopifyWebhook(body, hmacHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(body) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(order.id);
  const orderAmount = parseFloat(order.total_price ?? "0");

  for (const dc of order.discount_codes ?? []) {
    const voucher = await getVoucherByCode(dc.code.toUpperCase());
    if (!voucher) continue;
    if (voucher.status === "used") continue;

    await markVoucherUsed(voucher.voucher_id, orderId, orderAmount, order.email, order.phone ?? undefined);
    await logEvent(voucher.campaign_id, "purchase_completed", voucher.lead_id ?? undefined, "shopify_webhook", {
      shopify_order_id: orderId,
      order_amount: orderAmount,
      discount_code: dc.code,
      discount_tier: voucher.discount_tier,
    });
  }

  return NextResponse.json({ received: true });
}
