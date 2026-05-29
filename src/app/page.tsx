export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { getWeightStats } from "@/lib/weight-averager";
import { getProteinDistribution } from "@/lib/protein-distribution";
import { getWeeklyDeficit } from "@/lib/deficit-tracker";

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-3 text-center">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function TodayPage() {
  const today = new Date().toISOString().split("T")[0];

  const [targetsRes, dailyRes, garminRes, weightStats, proteinDist, deficit] = await Promise.all([
    db.from("user_targets").select("*").single(),
    db.from("daily_logs").select("*").eq("date", today).single(),
    db.from("garmin_data").select("*").eq("date", today).single(),
    getWeightStats(),
    getProteinDistribution(today),
    getWeeklyDeficit(),
  ]);

  const targets = targetsRes.data;
  const daily = dailyRes.data;
  const garmin = garminRes.data;

  const calorieTarget = targets?.calorie_target ?? 2000;
  const proteinTarget = targets?.protein_g ?? 160;
  const fiberTarget = targets?.fiber_g ?? 35;
  const waterTarget = targets?.water_ml ?? 2500;
  const stepsTarget = targets?.steps ?? 8000;

  const water = daily?.water_ml ?? 0;
  const steps = garmin?.steps ?? 0;
  const cals = proteinDist.totalCalories;
  const protein = proteinDist.totalProtein;
  const fiber = proteinDist.totalFiber;

  const mealIcons: Record<string, string> = { breakfast: "ðŸŒ…", lunch: "â˜€ï¸", dinner: "ðŸŒ™", snack: "ðŸŽ" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-bold">Today</h1>
        <span className="text-zinc-500 text-sm">{today}</span>
      </div>

      {/* Weight */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="flex justify-between items-start mb-3">
          <span className="text-sm font-medium text-zinc-300">Weight</span>
          {weightStats.alertHighLossRate && (
            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">âš ï¸ Fast loss</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Today" value={daily?.weight_kg ? `${daily.weight_kg}kg` : "â€”"} />
          <StatCard label="7-day avg" value={weightStats.rollingAvg7d ? `${weightStats.rollingAvg7d}kg` : "â€”"} />
          <StatCard
            label="Weekly"
            value={weightStats.weeklyLossRate ? `${weightStats.weeklyLossRate}kg` : "â€”"}
            sub="loss/wk"
          />
        </div>
      </div>

      {/* Calories */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm font-medium text-zinc-300">Calories</span>
          <span className="text-sm font-bold">
            {cals} <span className="text-zinc-500 font-normal">/ {calorieTarget}</span>
          </span>
        </div>
        <ProgressBar value={cals} max={calorieTarget} color={cals > calorieTarget ? "bg-red-500" : "bg-blue-500"} />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Protein</span>
              <span className={protein < proteinTarget * 0.9 ? "text-orange-400" : "text-green-400"}>
                {protein}g / {proteinTarget}g
              </span>
            </div>
            <ProgressBar value={protein} max={proteinTarget} color={protein < proteinTarget * 0.9 ? "bg-orange-500" : "bg-green-500"} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Fiber</span>
              <span>{fiber}g / {fiberTarget}g</span>
            </div>
            <ProgressBar value={fiber} max={fiberTarget} color="bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* Protein per meal */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm font-medium text-zinc-300 mb-3">Protein per meal</div>
        <div className="grid grid-cols-4 gap-2">
          {proteinDist.meals.map((m) => (
            <div key={m.slot} className="text-center">
              <div className="text-base mb-1">{mealIcons[m.slot]}</div>
              <div className={`text-sm font-bold ${m.isLowProtein ? "text-orange-400" : ""}`}>{m.protein}g</div>
              <div className="text-xs text-zinc-500 capitalize">{m.slot}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Water */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm font-medium text-zinc-300">ðŸ’§ Water</span>
          <span className="text-sm font-bold">
            {(water / 1000).toFixed(1)}L <span className="text-zinc-500 font-normal">/ {(waterTarget / 1000).toFixed(1)}L</span>
          </span>
        </div>
        <ProgressBar value={water} max={waterTarget} color="bg-cyan-500" />
      </div>

      {/* Garmin summary */}
      {garmin && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="text-sm font-medium text-zinc-300 mb-3">Garmin</div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Steps" value={steps.toLocaleString()} sub={`/ ${stepsTarget.toLocaleString()}`} />
            <StatCard label="Body Battery" value={garmin.body_battery_end ? `${garmin.body_battery_end}%` : "â€”"} />
            <StatCard label="Sleep" value={garmin.sleep_score ? `${garmin.sleep_score}/100` : "â€”"} />
          </div>
        </div>
      )}

      {/* Readiness */}
      {daily?.morning_energy && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="text-sm font-medium text-zinc-300 mb-3">Morning Readiness</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-bold">{daily.morning_energy}/10</div>
              <div className="text-xs text-zinc-500">Energy</div>
            </div>
            <div>
              <div className="text-lg font-bold">{daily.morning_soreness}/10</div>
              <div className="text-xs text-zinc-500">Soreness</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${(daily.morning_knee_pain ?? 0) >= 7 ? "text-red-400" : ""}`}>
                {daily.morning_knee_pain}/10
              </div>
              <div className="text-xs text-zinc-500">Knee</div>
            </div>
            <div>
              <div className="text-lg font-bold">{daily.morning_mood}/10</div>
              <div className="text-xs text-zinc-500">Mood</div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly deficit */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm font-medium text-zinc-300 mb-1">Weekly Deficit</div>
        <div className="text-2xl font-bold text-blue-400">{deficit.weeklyDeficit.toLocaleString()} kcal</div>
        <div className="text-xs text-zinc-500 mt-1">
          ~{deficit.projectedFatLossGrams}g fat Â· avg {deficit.dailyAvgIntake} in vs {deficit.dailyAvgTDEE} out
          {deficit.daysTracked < 7 && ` Â· ${deficit.daysTracked}/7 days tracked`}
        </div>
      </div>
    </div>
  );
}

