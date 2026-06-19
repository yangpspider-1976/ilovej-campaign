export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { listLeads } from "@/lib/db";
import { maskPhone } from "@/lib/phone";

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

  const leads = await listLeads(campaignId, limit, offset);

  if (format === "csv") {
    const rows = leads.map(l => [
      l.lead_id,
      l.campaign_id,
      l.name ?? "",
      maskPhone(l.phone_normalized),
      l.email ?? "",
      l.utm_source ?? "",
      l.utm_campaign ?? "",
      l.created_at,
    ]);

    const csv = [
      ["lead_id", "campaign_id", "name", "phone_masked", "email", "utm_source", "utm_campaign", "created_at"].join(","),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
      },
    });
  }

  const masked = leads.map(l => ({
    ...l,
    phone_raw: maskPhone(l.phone_normalized),
    phone_normalized: maskPhone(l.phone_normalized),
  }));

  return NextResponse.json({ leads: masked, count: leads.length });
}
