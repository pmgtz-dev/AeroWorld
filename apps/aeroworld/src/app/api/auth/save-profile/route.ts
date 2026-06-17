import { ApiException } from "@/lib/exceptions/ApiException";
import { verify } from "@/lib/auth/verify";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
    const avatarFile = incomingFormData.get("avatarFile");
    const backgroundImageFile = incomingFormData.get("backgroundImageFile");

    if (avatarFile instanceof File) {
      if (!avatarFile.type.startsWith("image/")) {
        return ApiException("INVALID_FILE_TYPE");
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        return ApiException("FILE_TOO_LARGE");
      }
    }

    if (backgroundImageFile instanceof File) {
      if (!backgroundImageFile.type.startsWith("image/")) {
        return ApiException("INVALID_FILE_TYPE");
      }
      if (backgroundImageFile.size > 5 * 1024 * 1024) {
        return ApiException("FILE_TOO_LARGE");
      }
    }

    const formData = new FormData();

    [
      "username",
      "nickname",
      "bio",
      "dateOfBirth",
      "showYearOfBirth",
      "likeStuff",
      "dislikeStuff",
      "avatarUrl",
      "backgroundImageUrl",
    ].forEach((key) => {
      const value = incomingFormData.get(key);
      if (typeof value === "string") {
        formData.append(key, value);
      }
    });

    if (avatarFile instanceof File) {
      formData.append("avatarFile", avatarFile);
    }

    if (backgroundImageFile instanceof File) {
      formData.append("backgroundImageFile", backgroundImageFile);
    }

    formData.append("accessToken", accessToken || "");
    formData.append("refreshToken", refreshToken || "");

    const saveRes = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/profile`, {
      method: "POST",
      body: formData,
    });

    const saveData = await saveRes.json();

    if (!saveRes.ok) {
      return ApiException(saveData.code || "SERVER_ERROR");
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: saveData.user.id,
        username: saveData.user.username,
        nickname: saveData.user.nickname,
        avatarUrl: saveData.user.avatar_url ?? null,
        backgroundImageUrl: saveData.user.background_image_url ?? null,
        bio: saveData.user.bio ?? null,
        dateOfBirth: saveData.user.date_of_birth ?? null,
        showYearOfBirth: !!saveData.user.show_year_of_birth,
        likeStuff: saveData.user.like_stuff ?? null,
        dislikeStuff: saveData.user.dislike_stuff ?? null,
        lastSeen: saveData.user.last_seen ?? null,
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
