import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { syncDailyStats, syncSleep, syncActivities } from "@/lib/garmin";

// One consolidated daily sync. The Vercel Hobby plan allows at most 2 cron jobs
// that each run once per day, so we fold all three Garmin syncs into a single
// endpoint. Each step is isolated in its own try/catch so one failure (e.g. an
// expired Garmin session) doesn't abort the others.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const steps: Array<[string, () => Promise<void>]> = [
    ["stats", syncDailyStats],
    ["sleep", syncSleep],
    ["activities", syncActivities],
  ];

  const results: Record<string, string> = {};
  for (const [name, fn] of steps) {
    try {
      await fn();
      results[name] = "ok";
    } catch (e) {
      results[name] = `error: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  return NextResponse.json({ ok: true, results });
}
