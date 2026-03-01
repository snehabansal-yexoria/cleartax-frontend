import { NextResponse } from "next/server";

export function middleware(req: any) {
  const token = req.cookies.get("idToken")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString(),
  );

  const role = payload["cognito:groups"]?.[0];

  const path = req.nextUrl.pathname;

  if (path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (path.startsWith("/super-admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/super-admin/:path*", "/dashboard/:path*"],
};
