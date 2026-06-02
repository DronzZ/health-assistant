export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { todayString } from "@/lib/date";
import { MealPlanEditor } from "@/components/MealPlanEditor";

export default async function MealPlanPage() {
  const { data } = await db
    .from("meal_plan")
    .select("id, day_of_week, meal_slot, food_item, target_grams, kcal_per_100g, protein_per_100g, fiber_per_100g, is_refeed_day")
    .order("day_of_week")
    .order("meal_slot");

  const items = data ?? [];

  // day_of_week is stored 0=Monday … 6=Sunday. JS getUTCDay() is 0=Sunday … 6=Saturday.
  const jsDay = new Date(`${todayString()}T12:00:00Z`).getUTCDay();
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1;

  return (
    <div className="space-y-4">
      <header className="rise pb-1">
        <h1 className="text-2xl font-bold tracking-tight">Meal plan</h1>
        <p className="text-xs text-muted">Tik een item om te bewerken · de coach kan dit ook aanpassen</p>
      </header>

      {items.length === 0 && (
        <div className="glass rise p-4 text-sm text-muted">
          Nog geen maaltijdplan. Voeg items toe per dag hieronder, of vraag je coach in Telegram om je plan op te zetten.
        </div>
      )}

      <MealPlanEditor items={items} todayIndex={todayIndex} />
    </div>
  );
}
