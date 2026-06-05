import { Injectable } from "@nestjs/common";
import * as jwt from "jsonwebtoken";

@Injectable()
export class TokenVerifierService {
  async verify(accessToken?: string, refreshToken?: string): Promise<{ userId: number }> {
    if (!refreshToken) throw new Error("NO_REFRESH");

    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, process.env.JWT_SECRET || "dev-secret") as any;
        const userId = Number(payload.sub);
        if (!Number.isFinite(userId)) throw new Error("BAD_SUB");
        return { userId };
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

    if (!res.ok) throw new Error("REFRESH_FAILED");

    const data: any = await res.json();
    const userId = Number(data.userId);
    if (!Number.isFinite(userId)) throw new Error("BAD_USER");
    return { userId };
  }
}
