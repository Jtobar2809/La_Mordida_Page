import { NextResponse } from "next/server";
import { auth } from "@/auth";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "0",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  // A conservative CSP — ajustar según CDN/terceros si es necesario
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https:;",
};

function withSecurityHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    try {
      res.headers.set(k, v);
    } catch (e) {
      // ignore header set failures in some envs
    }
  }
  return res;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isAccountRoute = nextUrl.pathname.startsWith("/cuenta");

  if (isAdminRoute) {
    if (!isLoggedIn) {
      const r = NextResponse.redirect(new URL(`/login?callbackUrl=${nextUrl.pathname}`, nextUrl));
      return withSecurityHeaders(r);
    }
    if (role !== "ADMIN") {
      const r = NextResponse.redirect(new URL("/", nextUrl));
      return withSecurityHeaders(r);
    }
  }

  if (isAccountRoute && !isLoggedIn) {
    const r = NextResponse.redirect(new URL(`/login?callbackUrl=${nextUrl.pathname}`, nextUrl));
    return withSecurityHeaders(r);
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/admin/:path*", "/cuenta/:path*"],
};
