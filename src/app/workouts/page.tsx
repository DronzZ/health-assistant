export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { getProgressiveOverloadStatus } from "@/lib/overload-tracker";

const trendIcon = { improving: "â†‘", plateau: "â†’", declining: "â†“" };
const trendColor = { improving: "text-green-400", plateau: "text-yellow-400", declining: "text-red-400" };

export default async function WorkoutsPage() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [workoutsRes, overload] = await Promise.all([
    db
      .from("workouts")
      .select("date, exercise, set_number, reps, weight_kg")
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .order("exercise")
      .order("set_number"),
    getProgressiveOverloadStatus(),
  ]);

  const workouts = workoutsRes.data ?? [];

  // Group by date â†’ exercise
  const byDate: Record<string, Record<string, { reps: number; weight_kg: number }[]>> = {};
  for (const w of workouts) {
    byDate[w.date] = byDate[w.date] ?? {};
    byDate[w.date][w.exercise] = byDate[w.date][w.exercise] ?? [];
    byDate[w.date][w.exercise].push({ reps: w.reps, weight_kg: w.weight_kg });
  }

  const dates = Object.keys(byDate).sort().reverse();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Workouts</h1>

      {/* Progressive overload status */}
      {overload.length > 0 && (
        <div className="bg-zinc-900 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
            Progressive overload (30 days)
          </div>
          <div className="divide-y divide-zinc-800">
            {overload.map((o) => (
              <div key={o.exercise} className="flex justify-between px-4 py-3 text-sm">
                <div className="capitalize">{o.exercise}</div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs">{o.recentBestKg}kg e1RM</span>
                  <span className={`font-bold ${trendColor[o.trend]}`}>
                    {trendIcon[o.trend]} {o.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Declining alert */}
      {overload.some((o) => o.trend === "declining") && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-sm text-red-400">
          âš ï¸ Declining performance on{" "}
          {overload
            .filter((o) => o.trend === "declining")
            .map((o) => o.exercise)
            .join(", ")}{" "}
          â€” check protein and calorie targets.
        </div>
      )}

      {/* Workout history */}
      {dates.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-4 text-zinc-500 text-sm">
          No workouts synced yet. Make sure Hevy sync is running.
        </div>
      ) : (
        dates.map((date) => (
          <div key={date} className="bg-zinc-900 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
              {date}
            </div>
            <div className="divide-y divide-zinc-800">
              {Object.entries(byDate[date]).map(([exercise, sets]) => (
                <div key={exercise} className="px-4 py-3">
                  <div className="text-sm font-medium capitalize mb-1">{exercise}</div>
                  <div className="text-xs text-zinc-500">
                    {sets.map((s, i) => `${s.weight_kg}kg Ã— ${s.reps}`).join(" Â· ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

