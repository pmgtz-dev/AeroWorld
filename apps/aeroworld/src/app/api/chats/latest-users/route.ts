import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verify } from "@/lib/auth/verify";
import { ApiException } from "@/lib/exceptions/ApiException";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  const userData = verify(accessToken, refreshToken);
  const { userId } = await userData;
  if (!userId) {
    return ApiException("UNAUTHORIZED");
  }

  const res = await fetch(
    `http://${process.env.API_DOM}:${process.env.API_PORT}/users/latest?limit=20&excludeUserId=${userId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await res.json();

  const normalized = Array.isArray(data)
    ? data.map((user) => ({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatar_url ?? null,
        backgroundImageUrl: user.background_image_url ?? null,
        bio: user.bio ?? null,
        dateOfBirth: user.date_of_birth ?? null,
        showYearOfBirth: !!user.show_year_of_birth,
        likeStuff: user.like_stuff ?? null,
        dislikeStuff: user.dislike_stuff ?? null,
        lastSeen: user.last_seen ?? null,
      }))
    : data;

  return NextResponse.json(normalized, { status: res.status });
}
