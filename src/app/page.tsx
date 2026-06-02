export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { todayString } from "@/lib/date";
import { getWeightStats } from "@/lib/weight-averager";
import { getProteinDistribution } from "@/lib/protein-distribution";
import { getWeeklyDeficit } from "@/lib/deficit-tracker";
import { Card, SectionLabel, Ring, Gauge, Sparkline, Bar } from "@/components/charts";
import { WaterStepper, WeightEditor } from "@/components/editors";

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function TodayPage() {
  const today = todayString();

  const [targetsRes, dailyRes, garminTodayRes, garminLatestRes, weightSeriesRes, weightStats, protein, deficit] =
    await Promise.all([
      db.from("user_targets").select("*").maybeSingle(),
      db.from("daily_logs").select("*").eq("date", today).maybeSingle(),
      db.from("garmin_data").select("*").eq("date", today).maybeSingle(),
      db.from("garmin_data").select("*").order("date", { ascending: false }).limit(1).maybeSingle(),
      db.from("daily_logs").select("date, weight_kg").not("weight_kg", "is", null).order("date", { ascending: false }).limit(21),
      getWeightStats(),
      getProteinDistribution(today),
      getWeeklyDeficit(),
    ]);

  const targets = targetsRes.data;
  const daily = dailyRes.data;
  const gToday = garminTodayRes.data;
  const gLatest = garminLatestRes.data;
  const g = gToday ?? gLatest;

  const calTarget = targets?.calorie_target ?? 2000;
  const proTarget = targets?.protein_g ?? 160;
  const waterTarget = targets?.water_ml ?? 2500;
  const stepsTarget = targets?.steps ?? 8000;

  const water = daily?.water_ml ?? 0;
  const steps = gToday?.steps ?? 0;
  const cals = protein.totalCalories;
  const pro = protein.totalProtein;

  const recovery: number | null =
    g?.training_readiness ?? g?.body_battery_end ?? (daily?.morning_energy ? daily.morning_energy * 10 : null);

  const weightSeries = (weightSeriesRes.data ?? []).map((r) => r.weight_kg as number).reverse();

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="rise flex items-end justify-between pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-xs text-muted">{fmtDate(today)}</p>
        </div>
        <div className="font-mono text-xs text-faint">{today}</div>
      </header>

      {/* Recovery gauge hero */}
      <Card delay={40} className="flex flex-col items-center">
        <Gauge value={recovery} label="Readiness" />
        <div className="mt-1 grid w-full grid-cols-3 gap-2 border-t border-hairline pt-3">
          <MiniStat label="HRV" value={g?.hrv_last_night ?? "—"} unit="ms" color="var(--color-sleep)" />
          <MiniStat label="Body Batt" value={g?.body_battery_end ?? "—"} color="var(--color-pro)" />
          <MiniStat label="Sleep" value={g?.sleep_score ?? "—"} color="var(--color-water)" />
        </div>
        {!g && <p className="mt-3 text-center text-xs text-faint">Garmin nog niet gesynct.</p>}
      </Card>

      {/* Daily target rings */}
      <Card delay={80}>
        <SectionLabel>Daily targets</SectionLabel>
        <div className="grid grid-cols-4 gap-1">
          <Ring
            value={cals}
            max={calTarget}
            size={74}
            stroke={7}
            color="var(--color-cal)"
            label="kcal"
            center={<RingNum value={Math.round(cals)} />}
          />
          <Ring
            value={pro}
            max={proTarget}
            size={74}
            stroke={7}
            color="var(--color-pro)"
            label="protein"
            center={<RingNum value={Math.round(pro)} suffix="g" />}
          />
          <Ring
            value={water}
            max={waterTarget}
            size={74}
            stroke={7}
            color="var(--color-water)"
            label="water"
            center={<RingNum value={(water / 1000).toFixed(1)} suffix="L" />}
          />
          <Ring
            value={steps}
            max={stepsTarget}
            size={74}
            stroke={7}
            color="var(--color-steps)"
            label="steps"
            center={<RingNum value={steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps} />}
          />
        </div>
      </Card>

      {/* Quick log */}
      <Card delay={120} className="space-y-4">
        <div>
          <SectionLabel>Water</SectionLabel>
          <WaterStepper current={water} target={waterTarget} />
          <div className="mt-2">
            <Bar value={water} max={waterTarget} color="var(--color-water)" />
          </div>
        </div>
        <div className="border-t border-hairline pt-4">
          <SectionLabel>Weight today</SectionLabel>
          <WeightEditor current={daily?.weight_kg ?? null} />
        </div>
      </Card>

      {/* Weight trend */}
      <Card delay={160}>
        <div className="mb-2 flex items-start justify-between">
          <SectionLabel>Weight trend</SectionLabel>
          {weightStats.alertHighLossRate && (
            <span className="rounded-full bg-alert/15 px-2 py-0.5 text-[10px] font-semibold text-alert">
              ⚠ Fast loss
            </span>
          )}
        </div>
        <div className="mb-3 flex items-end gap-5">
          <div>
            <div className="font-mono text-3xl font-bold leading-none">
              {weightStats.rollingAvg7d ?? "—"}
              <span className="text-sm font-medium text-muted">kg</span>
            </div>
            <div className="mt-1 text-[11px] text-muted">7-day avg</div>
          </div>
          {weightStats.weeklyLossRate != null && (
            <div>
              <div
                className="font-mono text-xl font-semibold leading-none"
                style={{ color: weightStats.weeklyLossRate > 0 ? "var(--color-pro)" : "var(--color-muted)" }}
              >
                {weightStats.weeklyLossRate > 0 ? "−" : ""}
                {Math.abs(weightStats.weeklyLossRate)}kg
              </div>
              <div className="mt-1 text-[11px] text-muted">per week</div>
            </div>
          )}
        </div>
        <Sparkline data={weightSeries} color="var(--color-ink)" unit="kg" />
      </Card>

      {/* Weekly deficit */}
      <Card delay={200}>
        <SectionLabel>Weekly deficit</SectionLabel>
        <div className="font-mono text-3xl font-bold text-cal">
          {deficit.weeklyDeficit.toLocaleString()}
          <span className="ml-1 text-sm font-medium text-muted">kcal</span>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          ≈ {deficit.projectedFatLossGrams}g fat · avg {deficit.dailyAvgIntake} in / {deficit.dailyAvgTDEE} out
          {deficit.daysTracked < 7 && ` · ${deficit.daysTracked}/7 days`}
        </p>
      </Card>
    </div>
  );
}

function RingNum({ value, suffix }: { value: React.ReactNode; suffix?: string }) {
  return (
    <div className="font-mono text-sm font-semibold leading-none text-ink">
      {value}
      {suffix && <span className="text-[10px] text-muted">{suffix}</span>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="font-mono text-lg font-semibold leading-none" style={{ color }}>
        {value}
        {unit && <span className="text-[10px] text-muted">{unit}</span>}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}
