import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { sendSupplementReminder } from "@/lib/supplement-reminders";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  await sendSupplementReminder("evening");
  return NextResponse.json({ ok: true });
}
