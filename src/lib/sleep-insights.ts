import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./model-router";
import { db } from "./db";
import { sendMessage } from "./telegram";

const client = new Anthropic();

export async function generateWeeklySleepInsight(): Promise<void> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const { data: sleepData } = await db
    .from("garmin_data")
    .select(
      "date, sleep_score, sleep_duration_min, deep_sleep_min, light_sleep_min, rem_sleep_min, awake_min, hrv_last_night, sleep_avg_hrv, sleep_avg_respiration, sleep_avg_spo2, body_battery_end, stress_avg"
    )
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  const { data: dailyData } = await db
    .from("daily_logs")
    .select("date, morning_energy, morning_soreness, morning_mood, morning_knee_pain")
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (!sleepData?.length) {
    await sendMessage("?? No sleep data available for insight generation.");
    return;
  }

  const avgScore = Math.round(
    sleepData.reduce((s, d) => s + (d.sleep_score ?? 0), 0) / sleepData.filter((d) => d.sleep_score).length
  );
  const avgDuration = Math.round(
    sleepData.reduce((s, d) => s + (d.sleep_duration_min ?? 0), 0) / sleepData.filter((d) => d.sleep_duration_min).length
  );
  const avgHRV = Math.round(
    sleepData.reduce((s, d) => s + (d.hrv_last_night ?? 0), 0) / sleepData.filter((d) => d.hrv_last_night).length
  );

  const context = `SLEEP DATA � last 30 days (${sleepData.length} nights):

Averages:
- Sleep score: ${avgScore}/100
- Duration: ${avgDuration} min (${Math.round(avgDuration / 60 * 10) / 10}h)
- HRV: ${avgHRV} ms

Nightly data (date | score | duration_min | deep | REM | HRV):
${sleepData
  .slice(-14)
  .map(
    (d) =>
      `${d.date} | ${d.sleep_score ?? "?"} | ${d.sleep_duration_min ?? "?"} | deep:${d.deep_sleep_min ?? "?"} | rem:${d.rem_sleep_min ?? "?"} | hrv:${d.hrv_last_night ?? "?"}`
  )
  .join("\n")}

Morning readiness (date | energy | soreness | mood):
${(dailyData ?? [])
  .slice(-14)
  .map((d) => `${d.date} | energy:${d.morning_energy ?? "?"} | soreness:${d.morning_soreness ?? "?"} | mood:${d.morning_mood ?? "?"}`)
  .join("\n")}`;

  const response = await client.messages.create({
    model: MODELS.opus,
    max_tokens: 600,
    system: `You are a sleep science expert analysing an athlete's sleep data. The user is an experienced lifter adding running, with chronic knee pain and poor recovery history.

Give a personalised weekly sleep insight in 3 parts:
1. Pattern identified (what the data shows � specific, honest)
2. Root cause hypothesis (what's likely driving this)
3. One actionable fix (specific, measurable, implementable tonight)

Be direct. No fluff.`,
    messages: [{ role: "user", content: context }],
  });

  const insight = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");

  await sendMessage(`?? *Weekly Sleep Insight*\n\n${insight}`);
}
