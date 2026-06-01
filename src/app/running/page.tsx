export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { getRunningStats } from "@/lib/running-tracker";
import { getKneePainTrend } from "@/lib/pain-tracker";

const typeLabel: Record<string, string> = {
  easy: "Easy run",
  tempo: "Tempo",
  long: "Long run",
  rest: "Rest",
  walk: "Walk",
};

const typeColor: Record<string, string> = {
  easy: "text-green-400",
  tempo: "text-orange-400",
  long: "text-blue-400",
  rest: "text-zinc-500",
  walk: "text-cyan-400",
};

export default async function RunningPage() {
  const [stats, planRes, pain] = await Promise.all([
    getRunningStats(),
    db
      .from("running_plan")
      .select("*")
      .order("week", { ascending: true })
      .order("session", { ascending: true }),
    getKneePainTrend(),
  ]);

  const plan = planRes.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Running</h1>

      {/* Weekly mileage */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm text-zinc-400 mb-3">Weekly mileage</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">This week</div>
            <div className="text-xl font-bold">{stats.thisWeekKm}km</div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Last week</div>
            <div className="text-xl font-bold">{stats.lastWeekKm}km</div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Change</div>
            <div className={`text-xl font-bold ${stats.spikeDetected ? "text-red-400" : ""}`}>
              {stats.increasePercent !== null ? `${stats.increasePercent > 0 ? "+" : ""}${stats.increasePercent}%` : "—"}
            </div>
          </div>
        </div>
        {stats.spikeDetected && (
          <p className="text-xs text-red-400 mt-3">
            ⚠️ Volume spike &gt;10% — high injury risk. Reduce this week's remaining runs.
          </p>
        )}
      </div>

      {/* Knee pain */}
      {pain && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div className="text-sm text-zinc-400 mb-2">Knee pain (14 days)</div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                pain.trending === "improving"
                  ? "bg-green-900/50 text-green-400"
                  : pain.trending === "worsening"
                  ? "bg-red-900/50 text-red-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {pain.trending}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Avg score</div>
              <div className={`text-2xl font-bold ${pain.avgScore >= 7 ? "text-red-400" : pain.avgScore >= 4 ? "text-orange-400" : "text-green-400"}`}>
                {pain.avgScore}/10
              </div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Peak score</div>
              <div className={`text-2xl font-bold ${pain.maxScore >= 7 ? "text-red-400" : ""}`}>
                {pain.maxScore}/10
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">{pain.runningCorrelation}</p>
          {pain.avgScore >= 7 && (
            <p className="text-xs text-red-400 mt-2">
              🚫 Average knee pain ≥ 7 — no running until this drops below 7.
            </p>
          )}
        </div>
      )}

      {/* Running plan */}
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
          Running Plan
        </div>
        {plan.length === 0 ? (
          <div className="px-4 py-3 text-zinc-500 text-sm">
            No running plan set up yet. Talk to your trainer to create one.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {plan.map((session) => (
              <div
                key={session.id}
                className={`flex justify-between items-center px-4 py-3 ${session.completed ? "opacity-50" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${typeColor[session.type] ?? ""}`}>
                      {typeLabel[session.type] ?? session.type}
                    </span>
                    {session.completed && <span className="text-xs text-green-500">✓</span>}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Week {session.week}, Session {session.session}
                    {session.target_distance_km ? ` · ${session.target_distance_km}km` : ""}
                    {session.target_duration_min ? ` · ${session.target_duration_min}min` : ""}
                  </div>
                  {session.knee_screen_notes && (
                    <div className="text-xs text-zinc-600 mt-0.5">{session.knee_screen_notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

