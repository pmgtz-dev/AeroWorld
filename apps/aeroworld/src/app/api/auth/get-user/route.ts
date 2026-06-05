import { ApiException } from "@/lib/exceptions/ApiException";

export async function getUserById(userId: number, accessToken: string) {
  const res = await fetch(`http://${process.env.API_DOM}:${process.env.API_PORT}/users/${userId}`, {
    method: "GET",
  });

  if (!res.ok) {
    return ApiException('USER_DOES_NOT_EXIST');
  }

  const data = await res.json();
  return data.user;
}