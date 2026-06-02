export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { todayString, dateStringDaysAgo } from "@/lib/date";
import { getProgressiveOverloadStatus } from "@/lib/overload-tracker";
import { Card, SectionLabel } from "@/components/charts";
import { WorkoutLogger } from "@/components/WorkoutLogger";

const trendMeta = {
  improving: { icon: "↑", color: "var(--color-pro)" },
  plateau: { icon: "→", color: "var(--color-warn)" },
  declining: { icon: "↓", color: "var(--color-alert)" },
} as const;

const actEmoji: Record<string, string> = {
  running: "🏃",
  treadmill_running: "🏃",
  cycling: "🚴",
  indoor_cycling: "🚴",
  strength_training: "🏋️",
  walking: "🚶",
  hiking: "🥾",
  cardio: "❤️",
};

export default async function TrainingPage() {
  const today = todayString();

  const [workoutsRes, activitiesRes, overload] = await Promise.all([
    db
      .from("workouts")
      .select("date, exercise, set_number, reps, weight_kg")
      .gte("date", dateStringDaysAgo(30))
      .order("date", { ascending: false })
      .order("exercise")
      .order("set_number"),
    db.from("garmin_activities").select("*").gte("date", dateStringDaysAgo(30)).order("date", { ascending: false }).limit(15),
    getProgressiveOverloadStatus(),
  ]);

  const workouts = workoutsRes.data ?? [];
  const activities = activitiesRes.data ?? [];

  // Today's logged exercises → grouped for the logger
  const loggedMap: Record<string, { reps: number; weight_kg: number }[]> = {};
  for (const w of workouts.filter((w) => w.date === today)) {
    (loggedMap[w.exercise] ??= []).push({ reps: w.reps, weight_kg: w.weight_kg });
  }
  const logged = Object.entries(loggedMap).map(([exercise, sets]) => ({ exercise, sets }));

  // Full history grouped by date → exercise
  const byDate: Record<string, Record<string, { reps: number; weight_kg: number }[]>> = {};
  for (const w of workouts) {
    (byDate[w.date] ??= {});
    (byDate[w.date][w.exercise] ??= []).push({ reps: w.reps, weight_kg: w.weight_kg });
  }
  const historyDates = Object.keys(byDate).sort().reverse();

  return (
    <div className="space-y-4">
      <header className="rise pb-1">
        <h1 className="text-2xl font-bold tracking-tight">Train</h1>
        <p className="text-xs text-muted">Strength logged by hand · cardio auto from Garmin</p>
      </header>

      <Card delay={40}>
        <SectionLabel>Log a lift</SectionLabel>
        <WorkoutLogger date={today} logged={logged} />
      </Card>

      {overload.length > 0 && (
        <Card delay={80}>
          <SectionLabel>Progressive overload · 30d</SectionLabel>
          <div className="divide-y divide-white/5">
            {overload.map((o) => {
              const t = trendMeta[o.trend];
              return (
                <div key={o.exercise} className="flex items-center justify-between py-2.5">
                  <span className="text-sm capitalize text-ink">{o.exercise}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-faint">{o.recentBestKg}kg e1RM</span>
                    <span className="font-mono text-sm font-bold" style={{ color: t.color }}>
                      {t.icon} {o.trend}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card delay={120}>
        <SectionLabel>Activities · Garmin</SectionLabel>
        {activities.length === 0 ? (
          <p className="py-2 text-sm text-muted">Geen recente activiteiten gesynct.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {activities.map((a) => (
              <div key={a.activity_id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{actEmoji[a.type ?? ""] ?? "🏅"}</span>
                  <div>
                    <div className="text-sm text-ink">{a.name ?? a.type ?? "Activity"}</div>
                    <div className="text-[11px] text-faint">{a.date}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-muted">
                  {a.distance_km ? `${a.distance_km.toFixed(1)}km · ` : ""}
                  {a.duration_min ? `${a.duration_min}m` : ""}
                  {a.avg_hr ? ` · ${a.avg_hr}bpm` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {historyDates.length > 0 && (
        <Card delay={160}>
          <SectionLabel>Lift history</SectionLabel>
          <div className="space-y-3">
            {historyDates.map((date) => (
              <div key={date}>
                <div className="mb-1 font-mono text-[11px] text-faint">{date}</div>
                <div className="space-y-1">
                  {Object.entries(byDate[date]).map(([exercise, sets]) => (
                    <div key={exercise} className="flex justify-between text-sm">
                      <span className="capitalize text-ink">{exercise}</span>
                      <span className="font-mono text-xs text-muted">
                        {sets.map((s) => `${s.weight_kg}×${s.reps}`).join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
