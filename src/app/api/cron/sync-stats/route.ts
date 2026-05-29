import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { syncDailyStats } from "@/lib/garmin";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  await syncDailyStats();
  return NextResponse.json({ ok: true });
}
