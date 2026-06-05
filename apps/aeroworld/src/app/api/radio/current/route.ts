import { NextResponse } from "next/server";

import { getRadioSnapshot } from "@/lib/radio";

export async function GET() {
  return NextResponse.json(await getRadioSnapshot(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
