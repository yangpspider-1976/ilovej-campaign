export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeSessionToken, getAdminSecret } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  let secret = "";
  try {
    const body = (await req.json()) as { secret?: string };
    secret = body.secret ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!secret || secret !== getAdminSecret()) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await makeSessionToken(getAdminSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
