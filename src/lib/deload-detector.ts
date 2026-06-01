import { db } from "./db";
import { sendMessage } from "./telegram";

export interface DeloadStatus {
  needed: boolean;
  reason: string;
  weeklyLoad: number[];
}

export async function checkDeload(): Promise<DeloadStatus> {
  const today = new Date();
  const sixWeeksAgo = new Date(today);
  sixWeeksAgo.setDate(today.getDate() - 42);

  const { data } = await db
    .from("garmin_data")
    .select("date, training_load")
    .gte("date", sixWeeksAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (!data?.length) return { needed: false, reason: "Insufficient data", weeklyLoad: [] };

  // Group by week
  const weeks: Record<string, number[]> = {};
  for (const row of data) {
    if (!row.training_load) continue;
    const d = new Date(row.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    weeks[key] = weeks[key] ?? [];
    weeks[key].push(row.training_load);
  }

  const weeklyTotals = Object.values(weeks).map((loads) => loads.reduce((a, b) => a + b, 0));

  if (weeklyTotals.length < 4) return { needed: false, reason: "Need 4 weeks of data", weeklyLoad: weeklyTotals };

  const recent4 = weeklyTotals.slice(-4);
  const avg = recent4.reduce((a, b) => a + b, 0) / recent4.length;

  // Deload if 4-week average load is above 400 (Garmin training load scale) or
  // if there are 4+ consecutive weeks with no significant drop
  const allHigh = recent4.every((w) => w > 300);
  const consistently_elevated = avg > 350;

  const needed = allHigh || consistently_elevated;
  const reason = consistently_elevated
    ? `4-week avg training load is ${Math.round(avg)} � deload recommended`
    : allHigh
    ? `4 consecutive high-load weeks (all > 300 load) � deload recommended`
    : "Training load within normal range";

  return { needed, reason, weeklyLoad: weeklyTotals };
}

export async function alertDeloadIfNeeded(): Promise<void> {
  const status = await checkDeload();
  if (status.needed) {
    await sendMessage(
      `?? *Deload Signal*\n\n${status.reason}\n\nYour body is asking for a recovery week. Drop volume by 40%, keep intensity, focus on sleep.`
    );
  }
}
