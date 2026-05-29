import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron-auth";
import { syncToNotion } from "@/lib/notion";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  if (!process.env.NOTION_ENABLED || process.env.NOTION_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "NOTION_ENABLED is false" });
  }

  await syncToNotion();
  return NextResponse.json({ ok: true });
}
