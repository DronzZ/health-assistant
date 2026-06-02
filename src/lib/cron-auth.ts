import { NextRequest, NextResponse } from "next/server";

// Accepts either:
//   - `Authorization: Bearer <CRON_SECRET>` — Vercel Cron injects this header
//     automatically when the CRON_SECRET env var is set.
//   - `x-cron-secret: <CRON_SECRET>` — for manual curl or an external scheduler
//     (e.g. cron-job.org) hitting the endpoints.
export function validateCronRequest(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!secret || (headerSecret !== secret && bearer !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
