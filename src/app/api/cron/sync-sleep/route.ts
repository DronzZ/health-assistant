import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { syncSleep } from "@/lib/garmin";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  await syncSleep();
  return NextResponse.json({ ok: true });
}
