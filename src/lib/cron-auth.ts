import { NextRequest, NextResponse } from "next/server";

export function validateCronRequest(req: NextRequest): NextResponse | null {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
