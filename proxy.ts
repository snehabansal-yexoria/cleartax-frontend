import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("idToken")?.value;
  const role = req.cookies.get("role")?.value;

  if (!token || !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/dashboard/super-admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/login/super-admin", req.url));
  }

  if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/login/admin", req.url));
  }

  if (pathname.startsWith("/dashboard/accountant") && role !== "accountant") {
    return NextResponse.redirect(new URL("/login/user", req.url));
  }

  if (pathname.startsWith("/dashboard/client") && role !== "client") {
    return NextResponse.redirect(new URL("/login/user", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
