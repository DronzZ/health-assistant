import { db } from "./db";

export interface MealProtein {
  slot: string;
  protein: number;
  fiber: number;
  calories: number;
  isLowProtein: boolean;
}

export interface ProteinDistributionStats {
  meals: MealProtein[];
  totalProtein: number;
  totalFiber: number;
  totalCalories: number;
  lowProteinMeals: string[];
  maxSingleMealProtein: number;
}

export async function getProteinDistribution(date: string): Promise<ProteinDistributionStats> {
  const { data, error } = await db
    .from("food_entries")
    .select("meal_slot, protein_g, fiber_g, calories")
    .eq("date", date);

  const food = data ?? [];
  const slots = ["breakfast", "lunch", "dinner", "snack"];

  const meals: MealProtein[] = slots.map((slot) => {
    const entries = food.filter((f: any) => f.meal_slot === slot);
    const protein = Math.round(entries.reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0));
    const fiber = Math.round(entries.reduce((s: number, f: any) => s + (f.fiber_g ?? 0), 0));
    const calories = Math.round(entries.reduce((s: number, f: any) => s + (f.calories ?? 0), 0));
    return { slot, protein, fiber, calories, isLowProtein: entries.length > 0 && protein < 25 };
  });

  const totalProtein = meals.reduce((s, m) => s + m.protein, 0);
  const totalFiber = meals.reduce((s, m) => s + m.fiber, 0);
  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
  const lowProteinMeals = meals.filter((m) => m.isLowProtein).map((m) => m.slot);
  const maxSingleMealProtein = Math.max(...meals.map((m) => m.protein), 0);

  return { meals, totalProtein, totalFiber, totalCalories, lowProteinMeals, maxSingleMealProtein };
}
