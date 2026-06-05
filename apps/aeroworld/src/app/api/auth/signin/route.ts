import { NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";

export async function POST(req: Request) {
  try{
    const { username, password } = await req.json();

    if (!username || !password) {
      return ApiException("MISSING_FIELDS");
    }

    const nestResponse_login = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    
    const data_login = await nestResponse_login.json();
    if (!nestResponse_login.ok) {
      return NextResponse.json(data_login, {
        status: nestResponse_login.status,
      });
    }

    const response = NextResponse.json(
      { ok: true, user: data_login.user, },
         //refresh: data_login.refreshToken,
         //access: data_login.accessToken},
      { status: 200 },
    );

    response.cookies.set("access_token", data_login.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60*15, 
    });

    response.cookies.set("refresh_token", data_login.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 100, // 100 лет
    });

    return response; 
    
  } catch(error){
    console.error("SIGNIN ERROR:", error);
    return ApiException("SERVER_ERROR")
  }
}