import { NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";
import { verify } from "@/lib/auth/verify";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;

    const userData = verify(accessToken, refreshToken)
    const { userId, accessToken: newAccessToken, refreshed } = await(userData);
    if ( !userId ){
      return ApiException("UNAUTHORIZED");
    }

    const chatsRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/chats/user/${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    const chatData = await chatsRes.json();

    if (!chatsRes.ok) {
      return ApiException(chatData.code || "SERVER_ERROR", chatsRes.status);
    }
    const response = NextResponse.json({ chats: chatData }, { status: 200 });

    if (refreshed && newAccessToken){
        response.cookies.set("access_token", newAccessToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60*15, 
      });
    }  
    return response;


  
}