import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { idToken } = await req.json();

  const response = NextResponse.json({ success: true });

  response.cookies.set("idToken", idToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });

  return response;
}
