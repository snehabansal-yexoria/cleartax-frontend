import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

interface TokenPayload {
  email: string;
  "custom:role"?: string;
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("idToken")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const decoded: TokenPayload = jwtDecode(token);

    const role = decoded["custom:role"] || "client";

    const path = req.nextUrl.pathname;

    // RBAC Rules

    if (path.startsWith("/dashboard/super-admin") && role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/dashboard/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/dashboard/accountant") && role !== "accountant") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/dashboard/client") && role !== "client") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
