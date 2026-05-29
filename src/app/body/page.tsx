export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { getWeightStats } from "@/lib/weight-averager";
import { getWeeklyDeficit } from "@/lib/deficit-tracker";

export default async function BodyPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split("T")[0];

  const [weightRes, measurementsRes, weightStats, deficit] = await Promise.all([
    db
      .from("daily_logs")
      .select("date, weight_kg, weight_7day_avg")
      .gte("date", startDate)
      .order("date", { ascending: false })
      .limit(30),
    db
      .from("body_measurements")
      .select("*")
      .order("date", { ascending: false })
      .limit(5),
    getWeightStats(),
    getWeeklyDeficit(),
  ]);

  const weights = weightRes.data ?? [];
  const measurements = measurementsRes.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Body</h1>
        {weightStats.alertHighLossRate && (
          <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">âš ï¸ High loss rate</span>
        )}
      </div>

      {/* Weight summary */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm text-zinc-400 mb-3">Weight</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Latest</div>
            <div className="text-xl font-bold">
              {weights[0]?.weight_kg ? `${weights[0].weight_kg}kg` : "â€”"}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">7-day avg</div>
            <div className="text-xl font-bold">
              {weightStats.rollingAvg7d ? `${weightStats.rollingAvg7d}kg` : "â€”"}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Rate/wk</div>
            <div className={`text-xl font-bold ${weightStats.alertHighLossRate ? "text-red-400" : ""}`}>
              {weightStats.weeklyLossRate ? `${weightStats.weeklyLossRate}kg` : "â€”"}
            </div>
          </div>
        </div>
        {weightStats.alertHighLossRate && (
          <p className="text-xs text-red-400 mt-3">
            Losing more than 1% of body weight per week â€” muscle loss risk. Increase calories or reduce activity.
          </p>
        )}
      </div>

      {/* Weight history table */}
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
          Last 30 days
        </div>
        <div className="divide-y divide-zinc-800 max-h-72 overflow-y-auto">
          {weights.length === 0 ? (
            <div className="px-4 py-3 text-zinc-500 text-sm">No weight data yet.</div>
          ) : (
            weights.map((w) => (
              <div key={w.date} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-zinc-400">{w.date}</span>
                <div className="flex gap-4">
                  <span>{w.weight_kg ? `${w.weight_kg}kg` : "â€”"}</span>
                  <span className="text-zinc-500 text-xs self-center">
                    {w.weight_7day_avg ? `avg ${w.weight_7day_avg}kg` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Deficit */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm text-zinc-400 mb-2">This week</div>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {deficit.weeklyDeficit.toLocaleString()} kcal
            </div>
            <div className="text-xs text-zinc-500 mt-1">weekly deficit</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-400">~{deficit.projectedFatLossGrams}g</div>
            <div className="text-xs text-zinc-500">projected fat loss</div>
          </div>
        </div>
        <div className="text-xs text-zinc-600 mt-2">
          Avg intake {deficit.dailyAvgIntake} kcal Â· avg TDEE {deficit.dailyAvgTDEE} kcal
          {deficit.daysTracked < 7 && ` Â· only ${deficit.daysTracked}/7 days tracked`}
        </div>
      </div>

      {/* Measurements */}
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
          Body Measurements
        </div>
        {measurements.length === 0 ? (
          <div className="px-4 py-3 text-zinc-500 text-sm">
            No measurements yet. Log with <code className="text-zinc-400">/measure</code> in Telegram.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {measurements.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="text-xs text-zinc-500 mb-2">{m.date}</div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                  {m.waist_cm && <div><span className="text-zinc-500">Waist </span>{m.waist_cm}cm</div>}
                  {m.hips_cm && <div><span className="text-zinc-500">Hips </span>{m.hips_cm}cm</div>}
                  {m.chest_cm && <div><span className="text-zinc-500">Chest </span>{m.chest_cm}cm</div>}
                  {m.left_arm_cm && <div><span className="text-zinc-500">L arm </span>{m.left_arm_cm}cm</div>}
                  {m.right_arm_cm && <div><span className="text-zinc-500">R arm </span>{m.right_arm_cm}cm</div>}
                  {m.left_thigh_cm && <div><span className="text-zinc-500">L thigh </span>{m.left_thigh_cm}cm</div>}
                  {m.right_thigh_cm && <div><span className="text-zinc-500">R thigh </span>{m.right_thigh_cm}cm</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

