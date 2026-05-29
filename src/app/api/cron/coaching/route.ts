import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { runDailyCoaching } from "@/lib/coaching";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  await runDailyCoaching();
  return NextResponse.json({ ok: true });
}
