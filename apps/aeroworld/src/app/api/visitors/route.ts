import { NextRequest, NextResponse } from "next/server";

import { readVisitorsStats, registerVisitor } from "@/lib/visitors";

const VISITOR_NUMBER_COOKIE_NAME = "aewo_unique_visitor_number";
const VISITOR_COOKIE_MAX_AGE_SEC = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const existingVisitorNumber = request.cookies.get(VISITOR_NUMBER_COOKIE_NAME)?.value;
  const currentStats = !existingVisitorNumber ? await readVisitorsStats() : null;
  const visitorNumber = existingVisitorNumber || String((currentStats?.totalVisitors ?? 0) + 1);
  const stats = await registerVisitor(visitorNumber, !existingVisitorNumber);

  const response = NextResponse.json(stats, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

  if (!existingVisitorNumber) {
    response.cookies.set(VISITOR_NUMBER_COOKIE_NAME, visitorNumber, {
      httpOnly: true,
      maxAge: VISITOR_COOKIE_MAX_AGE_SEC,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}
