"use server";

// Server Actions for editing the weekly meal plan from the dashboard. Auth-gated
// and error-checked like the other mutations. The AI coach edits the same table
// through its own tools in trainer.ts.

import { auth } from "@/auth";
import { db, runQuery } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireAuth(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export type MealItemInput = {
  id?: string;
  day_of_week: number;
  meal_slot: "breakfast" | "lunch" | "dinner" | "snack";
  food_item: string;
  target_grams?: number | null;
  kcal_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  fiber_per_100g?: number | null;
  is_refeed_day?: boolean;
};

export async function saveMealItem(input: MealItemInput): Promise<void> {
  await requireAuth();
  const { id, ...fields } = input;
  if (id) {
    await runQuery(db.from("meal_plan").update(fields).eq("id", id), "update meal item");
  } else {
    await runQuery(db.from("meal_plan").insert(fields), "add meal item");
  }
  revalidatePath("/meal-plan");
}

export async function deleteMealItem(id: string): Promise<void> {
  await requireAuth();
  await runQuery(db.from("meal_plan").delete().eq("id", id), "delete meal item");
  revalidatePath("/meal-plan");
}
