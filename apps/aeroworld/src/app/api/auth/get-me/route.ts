import { ApiException } from "@/lib/exceptions/ApiException";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  const meRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/me`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken, refreshToken }),
  });

  const meData = await meRes.json();

  if (!meRes.ok) {
    return ApiException('UNAUTHORIZED');
  }
  const response = NextResponse.json({
    ok: true,
    user: meData.user,
  })

  response.cookies.set("access_token", meData.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60*15, 
    });

  return response;
}