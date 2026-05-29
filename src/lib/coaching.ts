import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./model-router";
import { db } from "./db";
import { sendMessage } from "./telegram";
import { getWeightStats } from "./weight-averager";

const client = new Anthropic();

export async function runDailyCoaching(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const [targetsRes, dailyRes, foodRes, garminRes, workoutRes, weightStats] = await Promise.all([
    db.from("user_targets").select("*").single(),
    db.from("daily_logs").select("*").eq("date", today).single(),
    db.from("food_entries").select("*").eq("date", today),
    db.from("garmin_data").select("*").eq("date", today).single(),
    db.from("workouts").select("exercise, weight_kg, reps, set_number").eq("date", today),
    getWeightStats(),
  ]);

  const targets = targetsRes.data;
  const daily = dailyRes.data;
  const food = foodRes.data ?? [];
  const garmin = garminRes.data;
  const workouts = workoutRes.data ?? [];

  const totalCals = food.reduce((s: number, f: any) => s + (f.calories ?? 0), 0);
  const totalProtein = food.reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0);
  const totalFiber = food.reduce((s: number, f: any) => s + (f.fiber_g ?? 0), 0);
  const estimatedMeals = food.filter((f: any) => f.source === "estimated").length;

  // Check for protein distribution issues
  const mealSlots = ["breakfast", "lunch", "dinner", "snack"];
  const proteinByMeal = mealSlots.map((slot) => ({
    slot,
    protein: food.filter((f: any) => f.meal_slot === slot).reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0),
  }));
  const lowProteinMeals = proteinByMeal.filter((m) => m.protein > 0 && m.protein < 25).map((m) => m.slot);

  const context = `DATE: ${today}

INTAKE:
- Calories: ${Math.round(totalCals)} / ${targets?.calorie_target ?? 2000} kcal
- Protein: ${Math.round(totalProtein)}g / ${targets?.protein_g ?? 160}g
- Fiber: ${Math.round(totalFiber)}g / ${targets?.fiber_g ?? 35}g
- Water: ${daily?.water_ml ?? 0}ml / ${targets?.water_ml ?? 2500}ml
- Estimated macros in ${estimatedMeals} meals (less accurate)
${lowProteinMeals.length ? `- Low protein meals (< 25g): ${lowProteinMeals.join(", ")}` : ""}

WEIGHT:
- Today: ${daily?.weight_kg ?? "not logged"} kg
- 7-day avg: ${weightStats.rollingAvg7d ?? "insufficient data"} kg
- Weekly loss rate: ${weightStats.weeklyLossRate ?? "?"}kg/wk${weightStats.alertHighLossRate ? " ⚠️ ABOVE 1% OF BODYWEIGHT — MUSCLE LOSS RISK" : ""}

RECOVERY:
- Sleep score: ${garmin?.sleep_score ?? "no data"}
- Body Battery: ${garmin?.body_battery_end ?? "no data"}
- Recovery time remaining: ${garmin?.recovery_time_hours ?? "no data"}h
- HRV last night: ${garmin?.hrv_last_night ?? "no data"}
- Readiness: energy ${daily?.morning_energy ?? "?"}/10, soreness ${daily?.morning_soreness ?? "?"}/10, knee pain ${daily?.morning_knee_pain ?? "?"}/10, mood ${daily?.morning_mood ?? "?"}/10

GARMIN:
- Steps: ${garmin?.steps ?? "no data"} / target ${targets?.steps ?? 8000}
- Active calories: ${garmin?.calories_active ?? "no data"}

TRAINING:
${workouts.length ? `Exercises today: ${[...new Set(workouts.map((w: any) => w.exercise))].join(", ")}` : "No training logged today"}`;

  const response = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 700,
    system: `You are a ruthless personal trainer giving a daily check-in. The user is an experienced lifter adding running, with chronic knee pain and poor recovery.

STRICT FORMAT — 3 parts only:
1. ✅ What went right (1-2 sentences max, genuinely earned)
2. ❌ What missed (direct, hard, no sugarcoating — specific numbers)
3. 🎯 One action for tomorrow (concrete and measurable)

If weight loss rate exceeds 1%/week, it MUST be addressed — muscle loss risk.
If protein was low in any meal, call it out.
If water target was missed, call it out.
If no weight was logged, flag it.`,
    messages: [{ role: "user", content: `Here is today's data:\n${context}\n\nGive me my daily check-in.` }],
  });

  const reply = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");

  await sendMessage(`💪 *Daily Check-in — ${today}*\n\n${reply}`);
}

export async function checkWater(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await db.from("daily_logs").select("water_ml").eq("date", today).single();
  const water = data?.water_ml ?? 0;
  const { data: targets } = await db.from("user_targets").select("water_ml").single();
  const target = targets?.water_ml ?? 2500;

  if (water < 500) {
    await sendMessage(`💧 *Water check* — You've only had ${water}ml so far. Target is ${target}ml. Drink up.`);
  }
}

export async function checkFood(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await db.from("food_entries").select("id").eq("date", today).limit(1);
  if (!data?.length) {
    await sendMessage("🍽️ Nothing logged today. Log your food now — the data only works if it's accurate.");
  }
}
