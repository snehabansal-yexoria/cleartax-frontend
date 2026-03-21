import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtDecode } from "jwt-decode";

interface TokenPayload {
  email: string;
  "custom:role"?: string;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 🔥 Skip public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 🔥 Get token from cookie
  const token = req.cookies.get("idToken")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const decoded: TokenPayload = jwtDecode(token);
    const role = decoded["custom:role"];

    // 🔥 Route protection
    if (pathname.startsWith("/dashboard/super-admin")) {
      if (role !== "super_admin") {
        return NextResponse.redirect(new URL("/login/super-admin", req.url));
      }
    }

    if (pathname.startsWith("/dashboard/admin")) {
      if (role !== "admin") {
        return NextResponse.redirect(new URL("/login/admin", req.url));
      }
    }

    if (pathname.startsWith("/dashboard/accountant")) {
      if (role !== "accountant") {
        return NextResponse.redirect(new URL("/login/user", req.url));
      }
    }

    if (pathname.startsWith("/dashboard/client")) {
      if (role !== "client") {
        return NextResponse.redirect(new URL("/login/user", req.url));
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Proxy error:", error);

    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
