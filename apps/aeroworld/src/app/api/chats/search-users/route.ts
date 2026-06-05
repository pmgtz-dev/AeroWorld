import { NextRequest, NextResponse } from "next/server";
import { ApiException } from "@/lib/exceptions/ApiException";

export async function GET(req: NextRequest) {
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
  return NextResponse.json(data, { status: res.status });
}