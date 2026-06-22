export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidSession, getAdminSecret } from "@/lib/admin-auth";
import { resetCampaign } from "@/lib/db";

// Authorized if the request carries either a valid session cookie (browser) or
// the x-admin-secret header (programmatic/curl).
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = getAdminSecret();
  if (req.headers.get("x-admin-secret") === secret) return true;
  return isValidSession(req.cookies.get(ADMIN_COOKIE)?.value, secret);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let confirm = "";
  let campaignId = "ilovej_meta_test";
  try {
    const body = (await req.json()) as { confirm?: string; campaign_id?: string };
    confirm = body.confirm ?? "";
    if (body.campaign_id) campaignId = body.campaign_id;
  } catch {
    /* no body — confirm stays empty and is rejected below */
  }

  // Guard against accidental resets: the client must echo "RESET".
  if (confirm !== "RESET") {
    return NextResponse.json(
      { error: "Confirmation text did not match." },
      { status: 400 }
    );
  }

  const result = await resetCampaign(campaignId);
  return NextResponse.json({
    ok: true,
    message: `Campaign reset. ${result.vouchers} vouchers re-seeded.`,
    vouchers: result.vouchers,
  });
}
