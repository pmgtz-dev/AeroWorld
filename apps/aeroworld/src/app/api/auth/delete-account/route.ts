import { verify } from "@/lib/auth/verify";
import { ApiException } from "@/lib/exceptions/ApiException";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;

    const userData = verify(accessToken, refreshToken);
    const { userId, accessToken: newAccessToken, refreshed } = await userData;

    if (!userId) {
      return ApiException("UNAUTHORIZED");
    }

    const deleteRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/delete-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const deleteData = await deleteRes.json();

    if (!deleteRes.ok) {
      return ApiException(deleteData.code || "SERVER_ERROR");
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set("access_token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    response.cookies.set("refresh_token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    if (refreshed && newAccessToken) {
      response.cookies.set("access_token", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
    }

    return response;
  } catch {
    return ApiException("SERVER_ERROR");
  }
}
