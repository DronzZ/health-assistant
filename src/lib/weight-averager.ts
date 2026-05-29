import { db } from "./db";

export interface WeightStats {
  todayWeight: number | null;
  rollingAvg7d: number | null;
  weeklyLossRate: number | null; // kg/week
  lossRatePercent: number | null; // % of bodyweight per week
  alertHighLossRate: boolean;
}

export async function getWeightStats(): Promise<WeightStats> {
  const { data } = await db
    .from("daily_logs")
    .select("date, weight_kg")
    .not("weight_kg", "is", null)
    .order("date", { ascending: false })
    .limit(14);

  if (!data?.length) {
    return { todayWeight: null, rollingAvg7d: null, weeklyLossRate: null, lossRatePercent: null, alertHighLossRate: false };
  }

  const todayWeight = data[0]?.weight_kg ?? null;

  // 7-day rolling average
  const last7 = data.slice(0, 7).map((r) => r.weight_kg as number);
  const rollingAvg7d = last7.length
    ? Math.round((last7.reduce((a, b) => a + b, 0) / last7.length) * 10) / 10
    : null;

  // Weekly loss rate: compare current 7-day avg to previous 7-day avg
  const prev7 = data.slice(7, 14).map((r) => r.weight_kg as number);
  let weeklyLossRate: number | null = null;
  let lossRatePercent: number | null = null;
  let alertHighLossRate = false;

  if (prev7.length >= 4 && rollingAvg7d !== null) {
    const prevAvg = prev7.reduce((a, b) => a + b, 0) / prev7.length;
    weeklyLossRate = Math.round((prevAvg - rollingAvg7d) * 100) / 100;
    lossRatePercent = Math.round((weeklyLossRate / prevAvg) * 1000) / 10;
    // Alert if losing more than 1% of body weight per week
    alertHighLossRate = lossRatePercent > 1.0;
  }

  return { todayWeight, rollingAvg7d, weeklyLossRate, lossRatePercent, alertHighLossRate };
}

// Update the 7-day rolling average in daily_logs for today
export async function updateRollingAverage(date: string): Promise<void> {
  const stats = await getWeightStats();
  if (stats.rollingAvg7d === null) return;

  await db
    .from("daily_logs")
    .update({ weight_7day_avg: stats.rollingAvg7d })
    .eq("date", date);
}
