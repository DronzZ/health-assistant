export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { todayString } from "@/lib/date";
import { getWeightStats } from "@/lib/weight-averager";
import { Card, SectionLabel, Sparkline } from "@/components/charts";
import { WeightEditor, MeasurementsEditor } from "@/components/editors";

const M_FIELDS = [
  { key: "waist_cm", label: "Waist" },
  { key: "hips_cm", label: "Hips" },
  { key: "chest_cm", label: "Chest" },
  { key: "left_arm_cm", label: "L arm" },
  { key: "right_arm_cm", label: "R arm" },
  { key: "left_thigh_cm", label: "L thigh" },
  { key: "right_thigh_cm", label: "R thigh" },
] as const;

export default async function BodyPage() {
  const today = todayString();

  const [dailyTodayRes, weightRes, measurementsRes, weightStats] = await Promise.all([
    db.from("daily_logs").select("weight_kg").eq("date", today).maybeSingle(),
    db.from("daily_logs").select("date, weight_kg").not("weight_kg", "is", null).order("date", { ascending: false }).limit(30),
    db.from("body_measurements").select("*").order("date", { ascending: false }).limit(6),
    getWeightStats(),
  ]);

  const weightSeries = (weightRes.data ?? []).map((r) => r.weight_kg as number).reverse();
  const measurements = measurementsRes.data ?? [];
  const latest = measurements[0] ?? null;

  return (
    <div className="space-y-4">
      <header className="rise flex items-end justify-between pb-1">
        <h1 className="text-2xl font-bold tracking-tight">Body</h1>
        {weightStats.alertHighLossRate && (
          <span className="rounded-full bg-alert/15 px-2 py-0.5 text-[10px] font-semibold text-alert">⚠ Fast loss</span>
        )}
      </header>

      <Card delay={40}>
        <SectionLabel>Weight</SectionLabel>
        <div className="mb-4 flex items-end gap-5">
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
                {weightStats.weeklyLossRate > 0 ? "−" : "+"}
                {Math.abs(weightStats.weeklyLossRate)}kg
              </div>
              <div className="mt-1 text-[11px] text-muted">
                per week{weightStats.lossRatePercent != null ? ` · ${weightStats.lossRatePercent}%` : ""}
              </div>
            </div>
          )}
        </div>
        <Sparkline data={weightSeries} color="var(--color-ink)" unit="kg" />
        <div className="mt-4 border-t border-hairline pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">Log today</div>
          <WeightEditor current={dailyTodayRes.data?.weight_kg ?? null} />
        </div>
      </Card>

      <Card delay={80}>
        <SectionLabel>Measurements</SectionLabel>
        <MeasurementsEditor latest={latest} />
      </Card>

      {measurements.length > 0 && (
        <Card delay={120}>
          <SectionLabel>History</SectionLabel>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-faint">
                  <th className="py-1 pr-3 font-medium">Date</th>
                  {M_FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-1 text-right font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {measurements.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="py-2 pr-3 text-muted">{m.date}</td>
                    {M_FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-2 text-right text-ink">
                        {m[f.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
