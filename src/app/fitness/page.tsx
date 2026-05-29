export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";

export default async function FitnessPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const { data } = await db
    .from("garmin_data")
    .select(
      "date, steps, calories_active, calories_total, resting_hr, avg_hr, vo2max, body_battery_start, body_battery_end, body_battery_drain, stress_avg, stress_max, rest_stress_pct, training_load, training_readiness, recovery_time_hours, avg_respiration, avg_spo2, intensity_min_moderate, intensity_min_vigorous"
    )
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: false });

  const rows = data ?? [];
  const latest = rows[0];

  const avgSteps =
    rows.filter((r) => r.steps).length > 0
      ? Math.round(rows.filter((r) => r.steps).reduce((s, r) => s + (r.steps ?? 0), 0) / rows.filter((r) => r.steps).length)
      : null;

  const latestVo2 = rows.find((r) => r.vo2max)?.vo2max;
  const latestHR = rows.find((r) => r.resting_hr)?.resting_hr;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Fitness</h1>

      {/* Today's Garmin */}
      {latest && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-3">Today ({latest.date})</div>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Steps</div>
              <div className="text-xl font-bold">{latest.steps?.toLocaleString() ?? "â€”"}</div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Body Battery</div>
              <div className={`text-xl font-bold ${(latest.body_battery_end ?? 100) < 25 ? "text-red-400" : (latest.body_battery_end ?? 0) > 75 ? "text-green-400" : ""}`}>
                {latest.body_battery_end ?? "â€”"}%
              </div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Stress</div>
              <div className={`text-xl font-bold ${(latest.stress_avg ?? 0) > 50 ? "text-orange-400" : ""}`}>
                {latest.stress_avg ?? "â€”"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Active kcal</div>
              <div className="text-lg font-bold">{latest.calories_active ?? "â€”"}</div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Recovery</div>
              <div className="text-lg font-bold">
                {latest.recovery_time_hours ? `${latest.recovery_time_hours}h` : "â€”"}
              </div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Training load</div>
              <div className="text-lg font-bold">{latest.training_load ?? "â€”"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Key trends */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm text-zinc-400 mb-3">30-day trends</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">VOâ‚‚ max</div>
            <div className="text-2xl font-bold text-blue-400">{latestVo2 ?? "â€”"}</div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Resting HR</div>
            <div className="text-2xl font-bold">{latestHR ?? "â€”"}<span className="text-sm text-zinc-500"> bpm</span></div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Avg steps</div>
            <div className="text-2xl font-bold">{avgSteps?.toLocaleString() ?? "â€”"}</div>
          </div>
        </div>
      </div>

      {/* Steps history */}
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
          Daily overview (30 days)
        </div>
        <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-3 text-zinc-500 text-sm">No Garmin data yet.</div>
          ) : (
            rows.map((r) => (
              <div key={r.date} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-zinc-400">{r.date}</span>
                <div className="flex gap-3 text-xs items-center">
                  <span>{r.steps?.toLocaleString() ?? "â€”"} steps</span>
                  <span className="text-zinc-600">BB {r.body_battery_end ?? "â€”"}%</span>
                  <span className="text-zinc-600">
                    {r.recovery_time_hours ? `${r.recovery_time_hours}h rec` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

