import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { syncActivities } from "@/lib/garmin";
import { syncWorkouts } from "@/lib/hevy";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  await Promise.all([syncActivities(), syncWorkouts()]);
  return NextResponse.json({ ok: true });
}
