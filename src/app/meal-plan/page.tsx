export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const mealIcons: Record<string, string> = { breakfast: "ðŸŒ…", lunch: "â˜€ï¸", dinner: "ðŸŒ™", snack: "ðŸŽ" };

export default async function MealPlanPage() {
  const { data } = await db
    .from("meal_plan")
    .select("*")
    .order("day_of_week")
    .order("meal_slot");

  const plan = data ?? [];

  // Get today's day name
  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  const byDay: Record<string, typeof plan> = {};
  for (const item of plan) {
    byDay[item.day_of_week] = byDay[item.day_of_week] ?? [];
    byDay[item.day_of_week].push(item);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Meal Plan</h1>

      {plan.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-6 text-center text-zinc-500 text-sm">
          <p>No meal plan configured yet.</p>
          <p className="mt-1">Ask your trainer in Telegram to set up your meal plan.</p>
        </div>
      ) : (
        DAYS.map((day) => {
          const items = byDay[day] ?? [];
          if (items.length === 0) return null;

          const isRefeed = items.some((i) => i.is_refeed_day);
          const totalProtein = Math.round(
            items.reduce((s, i) => {
              if (!i.target_grams || !i.protein_per_100g) return s;
              return s + (i.target_grams * i.protein_per_100g) / 100;
            }, 0)
          );
          const totalCals = Math.round(
            items.reduce((s, i) => {
              if (!i.target_grams || !i.kcal_per_100g) return s;
              return s + (i.target_grams * i.kcal_per_100g) / 100;
            }, 0)
          );

          return (
            <div
              key={day}
              className={`bg-zinc-900 rounded-xl overflow-hidden ${day === todayName ? "ring-1 ring-blue-500" : ""}`}
            >
              <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">{day}</span>
                  {day === todayName && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Today</span>
                  )}
                  {isRefeed && (
                    <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded-full">Refeed</span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  {totalCals > 0 ? `${totalCals} kcal Â· ${totalProtein}g pro` : ""}
                </span>
              </div>
              <div className="divide-y divide-zinc-800">
                {SLOTS.map((slot) => {
                  const slotItems = items.filter((i) => i.meal_slot === slot);
                  if (slotItems.length === 0) return null;
                  return (
                    <div key={slot} className="px-4 py-3">
                      <div className="text-xs text-zinc-500 mb-2">
                        {mealIcons[slot]} {slot}
                      </div>
                      <div className="space-y-1.5">
                        {slotItems.map((item) => {
                          const itemProtein = item.target_grams && item.protein_per_100g
                            ? Math.round((item.target_grams * item.protein_per_100g) / 100)
                            : null;
                          const itemCals = item.target_grams && item.kcal_per_100g
                            ? Math.round((item.target_grams * item.kcal_per_100g) / 100)
                            : null;
                          const itemFiber = item.target_grams && item.fiber_per_100g
                            ? Math.round((item.target_grams * item.fiber_per_100g) / 100)
                            : null;
                          return (
                            <div key={item.id} className="flex justify-between items-start">
                              <div>
                                <span className="text-sm">{item.food_item}</span>
                                {item.target_grams && (
                                  <span className="text-xs text-zinc-500 ml-1">{item.target_grams}g</span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 text-right">
                                {itemCals && <span>{itemCals} kcal</span>}
                                {itemProtein && <span className="ml-1 text-zinc-400">{itemProtein}g pro</span>}
                                {itemFiber && <span className="ml-1">{itemFiber}g fiber</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

