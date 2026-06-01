import { db } from "./db";
import { sendMessage } from "./telegram";

const KEY_LIFTS = ["squat", "bench", "deadlift", "overhead press", "barbell row"];

interface LiftAlert {
  exercise: string;
  recentAvg: number;
  baselineAvg: number;
  dropPct: number;
}

export async function checkMuscleLoss(): Promise<LiftAlert[]> {
  const today = new Date();
  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(today.getDate() - 28);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);

  const alerts: LiftAlert[] = [];

  for (const lift of KEY_LIFTS) {
    const { data: baseline } = await db
      .from("workouts")
      .select("weight_kg, reps")
      .gte("date", fourWeeksAgo.toISOString().split("T")[0])
      .lt("date", twoWeeksAgo.toISOString().split("T")[0])
      .ilike("exercise", `%${lift}%`);

    const { data: recent } = await db
      .from("workouts")
      .select("weight_kg, reps")
      .gte("date", twoWeeksAgo.toISOString().split("T")[0])
      .ilike("exercise", `%${lift}%`);

    if (!baseline?.length || !recent?.length) continue;

    const e1rm = (w: any) => w.weight_kg * (1 + w.reps / 30);
    const avgE1rm = (rows: any[]) =>
      rows.reduce((s, r) => s + e1rm(r), 0) / rows.length;

    const baselineAvg = avgE1rm(baseline);
    const recentAvg = avgE1rm(recent);
    const dropPct = ((baselineAvg - recentAvg) / baselineAvg) * 100;

    if (dropPct > 5) {
      alerts.push({
        exercise: lift,
        recentAvg: Math.round(recentAvg * 10) / 10,
        baselineAvg: Math.round(baselineAvg * 10) / 10,
        dropPct: Math.round(dropPct * 10) / 10,
      });
    }
  }

  return alerts;
}

export async function alertMuscleLossIfNeeded(): Promise<void> {
  const alerts = await checkMuscleLoss();
  if (!alerts.length) return;

  const lines = alerts.map(
    (a) => `� ${a.exercise}: -${a.dropPct}% (${a.recentAvg} vs ${a.baselineAvg} e1RM)`
  );

  await sendMessage(
    `?? *Declining Performance Alert*\n\nLift performance dropped > 5% in the last 2 weeks � possible muscle loss:\n\n${lines.join("\n")}\n\nCheck: calories too low? Protein under target? Recovery poor? Act now before strength losses compound.`
  );
}
