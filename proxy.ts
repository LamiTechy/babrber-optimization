import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Guards the admin area. Next 16 renamed middleware to proxy; it runs on the
 * Node.js runtime, so the same JWT verification the API routes use works here.
 *
 * This is a convenience redirect/401 — every admin route handler also calls
 * `requireAdmin()` itself, so a matcher mistake cannot open anything up.
 */

const COOKIE = "gentry_admin";
const PUBLIC_ADMIN_PATHS = new Set(["/api/admin/login", "/api/admin/logout"]);

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE)?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "gentry" });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const authenticated = await hasValidSession(request);

  if (pathname.startsWith("/api/admin")) {
    if (!authenticated) {
      return Response.json(
        { ok: false, error: { code: "unauthorized", message: "Sign in to continue." } },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // The sign-in page itself must stay reachable.
  if (pathname === "/admin/login") {
    return authenticated ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }

  // Page routes: send signed-out visitors to the login screen.
  if (!authenticated) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
