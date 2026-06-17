import { ApiException } from "@/lib/exceptions/ApiException";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!accessToken && !refreshToken) {
    return ApiException("UNAUTHORIZED");
  }

  const meRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/me`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken, refreshToken }),
  });

  const meData = await meRes.json();

  if (!meRes.ok) {
    if (meRes.status === 401) {
      return ApiException("UNAUTHORIZED");
    }
    return NextResponse.json(meData, { status: meRes.status });
  }
  const mappedUser = {
    id: meData.user.id,
    username: meData.user.username,
    nickname: meData.user.nickname,
    avatarUrl: meData.user.avatar_url ?? null,
    backgroundImageUrl: meData.user.background_image_url ?? null,
    bio: meData.user.bio ?? null,
    dateOfBirth: meData.user.date_of_birth ?? null,
    showYearOfBirth: !!meData.user.show_year_of_birth,
    likeStuff: meData.user.like_stuff ?? null,
    dislikeStuff: meData.user.dislike_stuff ?? null,
    lastSeen: meData.user.last_seen ?? null,
  };
  const response = NextResponse.json({
    ok: true,
    user: mappedUser,
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
