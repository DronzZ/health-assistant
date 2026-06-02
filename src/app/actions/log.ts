"use server";

// Server Actions powering the interactive dashboard. Each one is reachable via a
// direct POST, so every action re-verifies the NextAuth session before touching
// the database (the dashboard is single-user, gated to ALLOWED_EMAIL). Writes go
// through `runQuery`, which throws on a Supabase error so the client can show an
// honest failure instead of a false success.

import { auth } from "@/auth";
import { db, runQuery } from "@/lib/db";
import { todayString } from "@/lib/date";
import { revalidatePath } from "next/cache";

async function requireAuth(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

// Refresh every route under the root layout so a value edited on one page shows
// up everywhere (the "Today" overview, the relevant detail page, etc.).
function refreshAll(): void {
  revalidatePath("/", "layout");
}

async function ensureDailyLog(date: string): Promise<void> {
  await runQuery(
    db.from("daily_logs").upsert({ date }, { onConflict: "date", ignoreDuplicates: true }),
    "ensure daily log"
  );
}

/** Add (or subtract, with a negative value) water in ml to today's running total. */
export async function addWater(ml: number): Promise<void> {
  await requireAuth();
  const today = todayString();
  await ensureDailyLog(today);
  const { data } = await db.from("daily_logs").select("water_ml").eq("date", today).maybeSingle();
  const current = data?.water_ml ?? 0;
  await runQuery(
    db.from("daily_logs").update({ water_ml: Math.max(0, current + ml) }).eq("date", today),
    "add water"
  );
  refreshAll();
}

export async function setWeight(kg: number): Promise<void> {
  await requireAuth();
  const today = todayString();
  await ensureDailyLog(today);
  await runQuery(
    db.from("daily_logs").update({ weight_kg: kg }).eq("date", today),
    "set weight"
  );
  refreshAll();
}

export async function setReadiness(input: {
  energy?: number | null;
  soreness?: number | null;
  knee_pain?: number | null;
  mood?: number | null;
}): Promise<void> {
  await requireAuth();
  const today = todayString();
  await ensureDailyLog(today);
  await runQuery(
    db.from("daily_logs").update({
      morning_energy: input.energy ?? null,
      morning_soreness: input.soreness ?? null,
      morning_knee_pain: input.knee_pain ?? null,
      morning_mood: input.mood ?? null,
    }).eq("date", today),
    "set readiness"
  );
  refreshAll();
}

export async function addFood(input: {
  name: string;
  grams?: number | null;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  meal_slot?: "breakfast" | "lunch" | "dinner" | "snack";
}): Promise<void> {
  await requireAuth();
  await runQuery(
    db.from("food_entries").insert({
      date: todayString(),
      name: input.name,
      grams_eaten: input.grams ?? null,
      calories: input.calories,
      protein_g: input.protein_g ?? 0,
      carbs_g: input.carbs_g ?? 0,
      fat_g: input.fat_g ?? 0,
      fiber_g: input.fiber_g ?? 0,
      meal_slot: input.meal_slot ?? "snack",
      source: "estimated",
    }),
    "add food"
  );
  refreshAll();
}

export async function deleteFood(id: string): Promise<void> {
  await requireAuth();
  await runQuery(db.from("food_entries").delete().eq("id", id), "delete food");
  refreshAll();
}

/** Log a strength exercise as one row per set. Replaces today's existing rows for
 *  the same exercise so re-submitting corrects rather than duplicates. */
export async function logWorkoutSets(input: {
  exercise: string;
  sets: { reps: number; weight_kg: number }[];
  date?: string;
}): Promise<void> {
  await requireAuth();
  const date = input.date ?? todayString();
  const exercise = input.exercise.toLowerCase().trim();
  if (!exercise || input.sets.length === 0) return;

  await runQuery(
    db.from("workouts").delete().eq("date", date).eq("exercise", exercise),
    "clear workout sets"
  );
  const rows = input.sets.map((s, i) => ({
    date,
    exercise,
    set_number: i + 1,
    reps: s.reps,
    weight_kg: s.weight_kg,
  }));
  await runQuery(db.from("workouts").insert(rows), "log workout");
  refreshAll();
}

export async function deleteWorkoutExercise(date: string, exercise: string): Promise<void> {
  await requireAuth();
  await runQuery(
    db.from("workouts").delete().eq("date", date).eq("exercise", exercise),
    "delete workout"
  );
  refreshAll();
}

export async function setMeasurements(input: {
  waist_cm?: number | null;
  hips_cm?: number | null;
  chest_cm?: number | null;
  left_arm_cm?: number | null;
  right_arm_cm?: number | null;
  left_thigh_cm?: number | null;
  right_thigh_cm?: number | null;
}): Promise<void> {
  await requireAuth();
  await runQuery(
    db.from("body_measurements").insert({ date: todayString(), ...input }),
    "save measurements"
  );
  refreshAll();
}
