import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSession, getAdminSecret } from "@/lib/admin-auth";

// Protect every /admin page behind the session cookie. The login page itself is
// exempt. API routes do their own auth (cookie or x-admin-secret header).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (await isValidSession(token, getAdminSecret())) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
