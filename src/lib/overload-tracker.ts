import { db } from "./db";

export interface OverloadStatus {
  exercise: string;
  trend: "improving" | "plateau" | "declining";
  recentBestKg: number;
  prKg: number | null;
  sessionCount: number;
}

export async function getProgressiveOverloadStatus(): Promise<OverloadStatus[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data } = await db
    .from("workouts")
    .select("exercise, weight_kg, reps, date")
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (!data?.length) return [];

  // Group by exercise
  const byExercise: Record<string, { date: string; weight_kg: number; reps: number }[]> = {};
  for (const row of data) {
    if (!row.exercise) continue;
    byExercise[row.exercise] = byExercise[row.exercise] ?? [];
    byExercise[row.exercise].push(row);
  }

  const results: OverloadStatus[] = [];
  const e1rm = (w: number, r: number) => w * (1 + r / 30);

  for (const [exercise, sessions] of Object.entries(byExercise)) {
    if (sessions.length < 2) continue;

    const e1rms = sessions.map((s) => e1rm(s.weight_kg, s.reps));
    const allTimeMax = Math.max(...e1rms);

    const firstHalf = e1rms.slice(0, Math.floor(e1rms.length / 2));
    const secondHalf = e1rms.slice(Math.floor(e1rms.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = ((secondAvg - firstAvg) / firstAvg) * 100;
    const trend: OverloadStatus["trend"] =
      diff > 3 ? "improving" : diff < -3 ? "declining" : "plateau";

    const recentBest = Math.max(...sessions.slice(-4).map((s) => e1rm(s.weight_kg, s.reps)));

    results.push({
      exercise,
      trend,
      recentBestKg: Math.round(recentBest * 10) / 10,
      prKg: Math.round(allTimeMax * 10) / 10,
      sessionCount: sessions.length,
    });
  }

  return results.sort((a, b) => {
    const order = { declining: 0, plateau: 1, improving: 2 };
    return order[a.trend] - order[b.trend];
  });
}
