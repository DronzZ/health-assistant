export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { dateStringDaysAgo } from "@/lib/date";
import { Card, SectionLabel, Sparkline } from "@/components/charts";

function hm(min: number | null): string {
  if (!min) return "—";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const STAGES = [
  { key: "deep_sleep_min", label: "Deep", color: "#4c63d9" },
  { key: "rem_sleep_min", label: "REM", color: "var(--color-sleep)" },
  { key: "light_sleep_min", label: "Light", color: "#5fa8d3" },
  { key: "awake_min", label: "Awake", color: "var(--color-faint)" },
] as const;

export default async function SleepPage() {
  const { data } = await db
    .from("garmin_data")
    .select(
      "date, sleep_score, sleep_duration_min, deep_sleep_min, light_sleep_min, rem_sleep_min, awake_min, hrv_last_night, hrv_status, sleep_avg_respiration, body_battery_end, stress_avg"
    )
    .gte("date", dateStringDaysAgo(30))
    .order("date", { ascending: false });

  const rows = data ?? [];
  const latest = rows[0];
  const scoreSeries = rows.map((r) => r.sleep_score as number).reverse();
  const hrvSeries = rows.map((r) => r.hrv_last_night as number).reverse();

  const stageTotal = STAGES.reduce((s, st) => s + ((latest?.[st.key] as number) ?? 0), 0);

  return (
    <div className="space-y-4">
      <header className="rise pb-1">
        <h1 className="text-2xl font-bold tracking-tight">Sleep</h1>
        <p className="text-xs text-muted">Last night · auto-synced from Garmin</p>
      </header>

      {!latest ? (
        <Card delay={40}>
          <p className="py-4 text-center text-sm text-muted">Nog geen Garmin-slaapdata. Synct automatisch elke ochtend.</p>
        </Card>
      ) : (
        <>
          <Card delay={40} className="flex items-center gap-5">
            <div>
              <div className="font-mono text-5xl font-bold leading-none text-water">{latest.sleep_score ?? "—"}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-faint">Sleep score</div>
            </div>
            <div className="flex-1">
              <div className="font-mono text-2xl font-semibold">{hm(latest.sleep_duration_min)}</div>
              <div className="mt-0.5 text-xs text-muted">in bed</div>
            </div>
          </Card>

          <Card delay={80}>
            <SectionLabel>Stages</SectionLabel>
            <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
              {STAGES.map((st) => {
                const v = (latest[st.key] as number) ?? 0;
                const pct = stageTotal > 0 ? (v / stageTotal) * 100 : 0;
                return <div key={st.key} style={{ width: `${pct}%`, background: st.color }} />;
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {STAGES.map((st) => (
                <div key={st.key} className="text-center">
                  <div className="mx-auto mb-1 h-1.5 w-6 rounded-full" style={{ background: st.color }} />
                  <div className="font-mono text-sm font-semibold">{hm(latest[st.key] as number)}</div>
                  <div className="text-[10px] text-faint">{st.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card delay={120}>
              <SectionLabel>HRV</SectionLabel>
              <div className="font-mono text-3xl font-bold text-sleep">
                {latest.hrv_last_night ?? "—"}
                <span className="text-sm font-medium text-muted">ms</span>
              </div>
              <div className="mt-1 text-xs capitalize text-muted">{latest.hrv_status ?? "—"}</div>
            </Card>
            <Card delay={140}>
              <SectionLabel>Recovery</SectionLabel>
              <div className="font-mono text-3xl font-bold text-pro">
                {latest.body_battery_end ?? "—"}
              </div>
              <div className="mt-1 text-xs text-muted">Body Battery · stress {latest.stress_avg ?? "—"}</div>
            </Card>
          </div>

          <Card delay={180}>
            <SectionLabel>Sleep score · 30d</SectionLabel>
            <Sparkline data={scoreSeries} color="var(--color-water)" />
          </Card>

          <Card delay={220}>
            <SectionLabel>HRV · 30d</SectionLabel>
            <Sparkline data={hrvSeries} color="var(--color-sleep)" unit="ms" />
          </Card>
        </>
      )}
    </div>
  );
}
