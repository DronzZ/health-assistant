import { db } from "./db";
import { sendMessage } from "./telegram";

export interface RunningWeekStats {
  thisWeekKm: number;
  lastWeekKm: number;
  increasePercent: number | null;
  spikeDetected: boolean;
  activitiesThisWeek: number;
}

export async function getRunningStats(): Promise<RunningWeekStats> {
  const today = new Date();

  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - today.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const { data } = await db
    .from("garmin_activities")
    .select("date, distance_km, type")
    .gte("date", startOfLastWeek.toISOString().split("T")[0])
    .ilike("type", "%running%");

  const thisWeekStart = startOfThisWeek.toISOString().split("T")[0];
  const lastWeekStart = startOfLastWeek.toISOString().split("T")[0];

  const thisWeek = (data ?? []).filter((a) => a.date >= thisWeekStart);
  const lastWeek = (data ?? []).filter((a) => a.date >= lastWeekStart && a.date < thisWeekStart);

  const thisWeekKm = thisWeek.reduce((s, a) => s + (a.distance_km ?? 0), 0);
  const lastWeekKm = lastWeek.reduce((s, a) => s + (a.distance_km ?? 0), 0);

  const increasePercent =
    lastWeekKm > 0 ? Math.round(((thisWeekKm - lastWeekKm) / lastWeekKm) * 100) : null;

  const spikeDetected = increasePercent !== null && increasePercent > 10;

  return {
    thisWeekKm: Math.round(thisWeekKm * 10) / 10,
    lastWeekKm: Math.round(lastWeekKm * 10) / 10,
    increasePercent,
    spikeDetected,
    activitiesThisWeek: thisWeek.length,
  };
}

export async function checkRunningSpike(): Promise<void> {
  const stats = await getRunningStats();

  if (stats.spikeDetected) {
    await sendMessage(
      `🏃 *Running Volume Spike Detected*\n\nThis week: ${stats.thisWeekKm}km vs last week: ${stats.lastWeekKm}km (+${stats.increasePercent}%)\n\n10% weekly mileage increase is the max for injury prevention — especially with your knee history. Dial it back.`
    );
  }
}

export async function getRunningPlanStatus(): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const { data: sessions } = await db
    .from("running_plan")
    .select("*")
    .order("week", { ascending: true })
    .order("session", { ascending: true })
    .limit(20);

  if (!sessions?.length) return "No running plan configured yet.";

  const completed = sessions.filter((s) => s.completed).length;
  const remaining = sessions.filter((s) => !s.completed);
  const next = remaining[0];

  if (!next) return "Running plan complete! Time to build the next block.";

  const typeLabel: Record<string, string> = {
    easy: "Easy run",
    tempo: "Tempo run",
    long: "Long run",
    rest: "Rest day",
    walk: "Walk",
  };

  return `Running plan: ${completed}/${sessions.length} sessions done\nNext: Week ${next.week}, Session ${next.session} — ${typeLabel[next.type] ?? next.type}${next.target_distance_km ? ` (${next.target_distance_km}km)` : ""}${next.target_duration_min ? ` / ${next.target_duration_min}min` : ""}`;
}
