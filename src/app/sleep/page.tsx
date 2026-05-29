export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";

function scoreColor(score: number | null) {
  if (!score) return "text-zinc-400";
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

export default async function SleepPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const { data } = await db
    .from("garmin_data")
    .select(
      "date, sleep_score, sleep_duration_min, deep_sleep_min, light_sleep_min, rem_sleep_min, awake_min, hrv_last_night, hrv_weekly_avg, hrv_status, sleep_avg_spo2, sleep_avg_respiration, body_battery_end"
    )
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: false });

  const rows = data ?? [];
  const latest = rows[0];

  const avgScore =
    rows.filter((r) => r.sleep_score).length > 0
      ? Math.round(
          rows.filter((r) => r.sleep_score).reduce((s, r) => s + (r.sleep_score ?? 0), 0) /
            rows.filter((r) => r.sleep_score).length
        )
      : null;

  const avgHRV =
    rows.filter((r) => r.hrv_last_night).length > 0
      ? Math.round(
          rows.filter((r) => r.hrv_last_night).reduce((s, r) => s + (r.hrv_last_night ?? 0), 0) /
            rows.filter((r) => r.hrv_last_night).length
        )
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Sleep</h1>

      {/* Latest night */}
      {latest && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-3">Last night ({latest.date})</div>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Score</div>
              <div className={`text-2xl font-bold ${scoreColor(latest.sleep_score)}`}>
                {latest.sleep_score ?? "â€”"}
              </div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">Duration</div>
              <div className="text-xl font-bold">
                {latest.sleep_duration_min
                  ? `${Math.floor(latest.sleep_duration_min / 60)}h${latest.sleep_duration_min % 60}m`
                  : "â€”"}
              </div>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">HRV</div>
              <div className="text-2xl font-bold">{latest.hrv_last_night ?? "â€”"}</div>
            </div>
          </div>

          {/* Sleep stages */}
          {latest.deep_sleep_min && (
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div>
                <div className="font-bold text-blue-400">{latest.deep_sleep_min}m</div>
                <div className="text-xs text-zinc-500">Deep</div>
              </div>
              <div>
                <div className="font-bold text-cyan-400">{latest.light_sleep_min ?? "â€”"}m</div>
                <div className="text-xs text-zinc-500">Light</div>
              </div>
              <div>
                <div className="font-bold text-purple-400">{latest.rem_sleep_min ?? "â€”"}m</div>
                <div className="text-xs text-zinc-500">REM</div>
              </div>
              <div>
                <div className="font-bold text-zinc-400">{latest.awake_min ?? "â€”"}m</div>
                <div className="text-xs text-zinc-500">Awake</div>
              </div>
            </div>
          )}

          {(latest.hrv_status || latest.sleep_avg_spo2) && (
            <div className="mt-3 flex gap-3 text-xs text-zinc-500">
              {latest.hrv_status && <span>HRV status: <span className="text-zinc-300">{latest.hrv_status}</span></span>}
              {latest.sleep_avg_spo2 && <span>SpOâ‚‚: <span className="text-zinc-300">{latest.sleep_avg_spo2}%</span></span>}
              {latest.sleep_avg_respiration && (
                <span>Resp: <span className="text-zinc-300">{latest.sleep_avg_respiration} br/min</span></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 30-day averages */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm text-zinc-400 mb-3">30-day averages</div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Avg score</div>
            <div className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore ?? "â€”"}</div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="text-xs text-zinc-500 mb-1">Avg HRV</div>
            <div className="text-2xl font-bold">{avgHRV ?? "â€”"}<span className="text-sm font-normal text-zinc-500"> ms</span></div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
          Sleep history (30 days)
        </div>
        <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-3 text-zinc-500 text-sm">No data yet.</div>
          ) : (
            rows.map((r) => (
              <div key={r.date} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-zinc-400">{r.date}</span>
                <div className="flex gap-4 items-center">
                  <span className={scoreColor(r.sleep_score)}>{r.sleep_score ?? "â€”"}/100</span>
                  <span className="text-zinc-500 text-xs">
                    {r.sleep_duration_min
                      ? `${Math.floor(r.sleep_duration_min / 60)}h${r.sleep_duration_min % 60}m`
                      : ""}
                  </span>
                  <span className="text-zinc-600 text-xs">
                    {r.hrv_last_night ? `HRV ${r.hrv_last_night}` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-600 text-center">
        Weekly sleep insights generated by Claude Opus â€” check Telegram for your latest insight.
      </p>
    </div>
  );
}

