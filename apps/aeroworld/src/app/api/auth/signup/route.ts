import { NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";

export async function POST(req: Request) {
  try{
    const { username, nickname, password } = await req.json();
    if (!username || !password || !nickname) {
      return ApiException("MISSING_FIELDS");
    }

    if (password.length < 6) {
      return ApiException("PASSWORD_TOO_WEAK", { minLength: 6 });
    }

    const nestResponse = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, nickname, password }),
    });

    const data = await nestResponse.json();

    if (!nestResponse.ok) {
      return NextResponse.json(data, {
        status: nestResponse.status,
      });
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
      { ok: true, user: data_login.user },
      { status: 200 }
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
    return ApiException("SERVER_ERROR")
  }
}