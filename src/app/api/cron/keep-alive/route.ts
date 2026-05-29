import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  // Simple read to keep Supabase free tier from pausing
  await db.from("user_targets").select("id").limit(1);
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
