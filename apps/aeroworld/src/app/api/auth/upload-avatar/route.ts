import { ApiException } from "@/lib/exceptions/ApiException";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verify } from "@/lib/auth/verify";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;

    const userData = verify(accessToken, refreshToken);
    const { userId, accessToken: newAccessToken, refreshed } = await userData;
    if (!userId) {
      return ApiException("UNAUTHORIZED");
    }

    const incomingFormData = await req.formData();
    const file = incomingFormData.get("file");

    if (!(file instanceof File)) {
      return ApiException("REQUEST_BODY_HAS_MISSING_FIELDS");
    }

    if (!file.type.startsWith("image/")) {
      return ApiException("INVALID_FILE_TYPE");
    }

    if (file.size > 5 * 1024 * 1024) {
      return ApiException("FILE_TOO_LARGE");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accessToken", accessToken || "");
    formData.append("refreshToken", refreshToken || "");

    const uploadRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/avatar`, {
      method: "POST",
      body: formData,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      return ApiException(uploadData.code || "SERVER_ERROR");
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: uploadData.user.id,
        username: uploadData.user.username,
        nickname: uploadData.user.nickname,
        avatarUrl: uploadData.user.avatar_url ?? null,
        backgroundImageUrl: uploadData.user.background_image_url ?? null,
        bio: uploadData.user.bio ?? null,
        dateOfBirth: uploadData.user.date_of_birth ?? null,
        showYearOfBirth: !!uploadData.user.show_year_of_birth,
        likeStuff: uploadData.user.like_stuff ?? null,
        dislikeStuff: uploadData.user.dislike_stuff ?? null,
        lastSeen: uploadData.user.last_seen ?? null,
      },
    });

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
