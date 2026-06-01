export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";

const sourceLabel: Record<string, { text: string; color: string }> = {
  photo_label: { text: "label scan", color: "text-green-400" },
  database: { text: "database", color: "text-blue-400" },
  estimated: { text: "estimated ⚠️", color: "text-orange-400" },
};

const mealIcons: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

export default async function FoodPage() {
  const today = new Date().toISOString().split("T")[0];

  const { data: entries } = await db
    .from("food_entries")
    .select("*")
    .eq("date", today)
    .order("meal_slot")
    .order("id");

  const { data: targets } = await db.from("user_targets").select("calorie_target, protein_g, fiber_g").single();

  const food = entries ?? [];
  const slots = ["breakfast", "lunch", "dinner", "snack"];

  const totals = {
    calories: Math.round(food.reduce((s: number, f: any) => s + (f.calories ?? 0), 0)),
    protein: Math.round(food.reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0)),
    carbs: Math.round(food.reduce((s: number, f: any) => s + (f.carbs_g ?? 0), 0)),
    fat: Math.round(food.reduce((s: number, f: any) => s + (f.fat_g ?? 0), 0)),
    fiber: Math.round(food.reduce((s: number, f: any) => s + (f.fiber_g ?? 0), 0)),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Food Log</h1>

      {/* Totals */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-sm text-zinc-400 mb-2">Today's totals</div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: "kcal", value: totals.calories, target: targets?.calorie_target },
            { label: "protein", value: `${totals.protein}g`, target: targets?.protein_g ? `${targets.protein_g}g` : undefined },
            { label: "carbs", value: `${totals.carbs}g` },
            { label: "fat", value: `${totals.fat}g` },
            { label: "fiber", value: `${totals.fiber}g`, target: targets?.fiber_g ? `${targets.fiber_g}g` : undefined },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-base font-bold">{s.value}</div>
              {s.target && <div className="text-xs text-zinc-500">/ {s.target}</div>}
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Meals */}
      {slots.map((slot) => {
        const slotEntries = food.filter((f: any) => f.meal_slot === slot);
        const slotProtein = Math.round(slotEntries.reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0));
        const slotFiber = Math.round(slotEntries.reduce((s: number, f: any) => s + (f.fiber_g ?? 0), 0));
        const slotCals = Math.round(slotEntries.reduce((s: number, f: any) => s + (f.calories ?? 0), 0));

        return (
          <div key={slot} className="bg-zinc-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="font-medium capitalize">
                {mealIcons[slot]} {slot}
              </span>
              <span className="text-xs text-zinc-500">
                {slotCals} kcal · {slotProtein}g pro · {slotFiber}g fiber
              </span>
            </div>
            {slotEntries.length === 0 ? (
              <div className="px-4 py-3 text-zinc-600 text-sm">Nothing logged</div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {slotEntries.map((f: any) => {
                  const src = sourceLabel[f.source] ?? { text: f.source, color: "text-zinc-500" };
                  return (
                    <div key={f.id} className="px-4 py-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium">{f.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {f.grams_eaten ? `${f.grams_eaten}g · ` : ""}
                            {Math.round(f.calories)} kcal · {Math.round(f.protein_g)}g pro
                            {f.fiber_g ? ` · ${Math.round(f.fiber_g)}g fiber` : ""}
                          </div>
                        </div>
                        <span className={`text-xs mt-0.5 ${src.color}`}>{src.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-zinc-600 text-center">Log food by sending a message or nutrition photo to your Telegram bot.</p>
    </div>
  );
}

