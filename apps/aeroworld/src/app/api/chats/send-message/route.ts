import { NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";
import { verify } from "@/lib/auth/verify";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const {
      otherUserId,
      content,
      forwardedFromMessageId = null,
      replyToMessageId = null,
    } = await req.json();

    if ( !otherUserId || !content){
      return ApiException("REQUEST_BODY_HAS_MISSING_FIELDS");
    }

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

    const sendRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/chats/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        senderId: userId,
        content,
        replyToMessageId,
        forwardedFromMessageId,
      }),
    });

    const message = await sendRes.json();

    if (!sendRes.ok) {
      return ApiException(message.code || "SERVER_ERROR", sendRes.status);
    }

    const response = NextResponse.json({ message }, { status: 200 })
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

  } catch {
    return ApiException("SERVER_ERROR");
  }
}
