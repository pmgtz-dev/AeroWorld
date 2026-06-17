import { NextRequest, NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";
import { verify } from "@/lib/auth/verify";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;
  const userData = verify(accessToken, refreshToken);
  const { userId } = await userData;

  if (!userId) {
    return ApiException("UNAUTHORIZED");
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("username");

  if (!query) {
    return ApiException('MISSING_FIELDS');
  }

  const res = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/search?username=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    }
  });

  const data = await res.json();
  const normalized = Array.isArray(data)
    ? data
        .filter((user) => Number(user.id) !== Number(userId))
        .map((user) => ({
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
