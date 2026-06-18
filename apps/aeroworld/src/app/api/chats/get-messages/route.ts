import { NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";
import { verify } from "@/lib/auth/verify";
import { cookies } from "next/headers";  

export async function POST(req: Request) {
    const { otherUserId, take, lastMessageId } = await req.json();
    if (!otherUserId)
      return ApiException("REQUEST_BODY_HAS_MISSING_FIELDS");

    const params = new URLSearchParams();
    if (take) params.set("take", String(take));
    if (lastMessageId) params.set("lastMessageId", String(lastMessageId));

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;

    const userData = verify(accessToken, refreshToken)
    const { userId, accessToken: newAccessToken, refreshed } = await(userData);
    if ( !userId ){
      return ApiException("UNAUTHORIZED");
    }

    const chatRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/chats/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, otherUserId }),
    });

    const chatData = await chatRes.json();

    if (!chatRes.ok) {
      return ApiException(chatData.code || "SERVER_ERROR", chatRes.status);
    }

    const chatId = chatData.id;

    params.set("userId", String(userId));
    const messagesRes = await fetch(
      `http://${process.env.API_DOM}:${process.env.API_PORT}/chats/${chatId}/messages/?${params.toString()}`,
      { method: "GET" }
    );

    const messages = await messagesRes.json();

    if (!messagesRes.ok) {
      return ApiException(messages.code || "SERVER_ERROR", messagesRes.status);
    }
    
    const response = NextResponse.json({ chatId, messages }, { status: 200 })
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
