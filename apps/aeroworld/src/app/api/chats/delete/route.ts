import { NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";
import { verify } from "@/lib/auth/verify";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { chatId, scope } = await req.json();
    if (!chatId || (scope !== "self" && scope !== "other" && scope !== "all")) {
      return ApiException("REQUEST_BODY_HAS_MISSING_FIELDS");
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;
    const userData = verify(accessToken, refreshToken);
    const { userId, accessToken: newAccessToken, refreshed } = await userData;
    if (!userId) {
      return ApiException("UNAUTHORIZED");
    }

    const deleteRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/chats/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, userId, scope }),
    });

    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) {
      return ApiException(deleteData.code || "SERVER_ERROR", deleteRes.status);
    }
    const response = NextResponse.json(deleteData, { status: 200 });

    if (refreshed && newAccessToken) {
      response.cookies.set("access_token", newAccessToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 15,
      });
    }

    return response;
  } catch {
    return ApiException("SERVER_ERROR");
  }
}
