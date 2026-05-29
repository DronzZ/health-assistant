import { db } from "./db";

export interface DeficitStats {
  weeklyDeficit: number;
  projectedFatLossGrams: number;
  dailyAvgIntake: number;
  dailyAvgTDEE: number;
  daysTracked: number;
}

export async function getWeeklyDeficit(): Promise<DeficitStats> {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const startDate = sevenDaysAgo.toISOString().split("T")[0];

  const [foodRes, garminRes, targetsRes] = await Promise.all([
    db
      .from("food_entries")
      .select("date, calories")
      .gte("date", startDate),
    db
      .from("garmin_data")
      .select("date, calories_total")
      .gte("date", startDate),
    db.from("user_targets").select("tdee, calorie_target").single(),
  ]);

  const food = foodRes.data ?? [];
  const garmin = garminRes.data ?? [];
  const tdee = targetsRes.data?.tdee ?? 2400;

  // Group food calories by date
  const caloriesByDate: Record<string, number> = {};
  for (const entry of food) {
    caloriesByDate[entry.date] = (caloriesByDate[entry.date] ?? 0) + (entry.calories ?? 0);
  }

  // Use Garmin total calories if available, else fall back to TDEE from targets
  const tdeeByDate: Record<string, number> = {};
  for (const row of garmin) {
    if (row.calories_total) tdeeByDate[row.date] = row.calories_total;
  }

  const trackedDates = Object.keys(caloriesByDate);
  if (!trackedDates.length) {
    return { weeklyDeficit: 0, projectedFatLossGrams: 0, dailyAvgIntake: 0, dailyAvgTDEE: tdee, daysTracked: 0 };
  }

  const totalIntake = trackedDates.reduce((s, d) => s + caloriesByDate[d], 0);
  const totalTDEE = trackedDates.reduce((s, d) => s + (tdeeByDate[d] ?? tdee), 0);
  const weeklyDeficit = totalTDEE - totalIntake;

  return {
    weeklyDeficit: Math.round(weeklyDeficit),
    projectedFatLossGrams: Math.round((weeklyDeficit / 7700) * 1000),
    dailyAvgIntake: Math.round(totalIntake / trackedDates.length),
    dailyAvgTDEE: Math.round(totalTDEE / trackedDates.length),
    daysTracked: trackedDates.length,
  };
}
