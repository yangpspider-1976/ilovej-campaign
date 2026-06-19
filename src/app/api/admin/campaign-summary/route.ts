export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCampaignSummary, getTierCounts } from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "changeme";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaignId = req.nextUrl.searchParams.get("campaign_id") ?? "ilovej_meta_test";

  const [summary, tierCounts] = await Promise.all([
    getCampaignSummary(campaignId),
    getTierCounts(campaignId),
  ]);

  return NextResponse.json({ summary, tier_counts: tierCounts });
}
