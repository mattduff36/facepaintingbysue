import { NextResponse, type NextRequest } from "next/server";
import { readAdminEnv, adminCookieName } from "./lib/admin-env";
import { verifySessionValue } from "./lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  const isHttps = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https"
    || request.nextUrl.protocol === "https:";
  const cookieName = isHttps ? adminCookieName(true) : adminCookieName(false);
  const raw = request.cookies.get(cookieName)?.value
    ?? request.cookies.get(adminCookieName(false))?.value;

  let sessionOk = false;
  try {
    sessionOk = Boolean(verifySessionValue(raw, readAdminEnv()));
  } catch {
    sessionOk = false;
  }

  if (pathname !== "/admin" && pathname !== "/admin/" && !sessionOk) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin";
    login.search = "";
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
