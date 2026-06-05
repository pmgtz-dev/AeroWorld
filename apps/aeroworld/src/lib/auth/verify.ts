import jwt from "jsonwebtoken";

type RefreshResult = {
  userId: number | null;
  accessToken: string | null;
  refreshed: boolean;
};
const unauth_user = {
  userId: null,
  accessToken: null,
  refreshed: false
}
export async function verify(accessToken?: string, refreshToken?: string): Promise<RefreshResult> {
  if (!refreshToken) {
    return unauth_user;
  }

  if (accessToken) {
    try {
      const payload = jwt.verify(
        accessToken,
        process.env.JWT_SECRET || "dev-secret"
      ) as any;

      return {
        userId: payload.sub,
        accessToken,
        refreshed: false,
      };
    } catch {}
  }

  const res = await fetch(
    `http://${process.env.API_DOM}:${process.env.API_PORT}/users/refresh-access-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken, accessToken }),
    }
  );

  if (!res.ok) {
    return unauth_user;
  }

  const data = await res.json();

  return {
    userId: data.userId,
    accessToken: data.accessToken,
    refreshed: true,
  };
}