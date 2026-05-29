import { db } from "./db";
import { sendMessage } from "./telegram";

export async function checkTDEERecalibration(): Promise<void> {
  const { data: targets } = await db
    .from("user_targets")
    .select("last_tdee_recalc_weight_kg, last_tdee_recalc_date, calorie_target, tdee")
    .single();

  if (!targets?.last_tdee_recalc_weight_kg) return;

  const { data: latestLog } = await db
    .from("daily_logs")
    .select("weight_7day_avg, date")
    .order("date", { ascending: false })
    .not("weight_7day_avg", "is", null)
    .limit(1)
    .single();

  if (!latestLog?.weight_7day_avg) return;

  const drop = targets.last_tdee_recalc_weight_kg - latestLog.weight_7day_avg;

  if (drop >= 4.5) {
    await sendMessage(
      `📊 *TDEE Recalibration Due*\n\nYou've lost ${Math.round(drop * 10) / 10}kg since your last calibration (${targets.last_tdee_recalc_date}).\n\nYour metabolic rate has dropped. Current calorie target (${targets.calorie_target} kcal) may now be a smaller deficit than intended — or could be causing an unintended surplus.\n\nReply: "recalculate my TDEE" and I'll walk you through it.`
    );
  }
}
