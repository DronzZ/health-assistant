export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { todayString } from "@/lib/date";
import { getProteinDistribution } from "@/lib/protein-distribution";
import { Card, SectionLabel, Ring } from "@/components/charts";
import { FoodLogger } from "@/components/FoodLogger";

const mealEmoji: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

export default async function FoodPage() {
  const today = todayString();

  const [targetsRes, foodRes, protein] = await Promise.all([
    db.from("user_targets").select("*").maybeSingle(),
    db
      .from("food_entries")
      .select("id, name, calories, protein_g, fiber_g, grams_eaten, meal_slot")
      .eq("date", today)
      .order("created_at"),
    getProteinDistribution(today),
  ]);

  const targets = targetsRes.data;
  const entries = foodRes.data ?? [];

  const calTarget = targets?.calorie_target ?? 2000;
  const proTarget = targets?.protein_g ?? 160;
  const fibTarget = targets?.fiber_g ?? 35;

  return (
    <div className="space-y-4">
      <header className="rise flex items-end justify-between pb-1">
        <h1 className="text-2xl font-bold tracking-tight">Fuel</h1>
        <Link
          href="/meal-plan"
          className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          Meal plan →
        </Link>
      </header>

      <Card delay={40}>
        <SectionLabel>Macros today</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Ring
            value={protein.totalCalories}
            max={calTarget}
            size={88}
            color="var(--color-cal)"
            label="kcal"
            center={<RingNum value={Math.round(protein.totalCalories)} sub={`/ ${calTarget}`} />}
          />
          <Ring
            value={protein.totalProtein}
            max={proTarget}
            size={88}
            color="var(--color-pro)"
            label="protein"
            center={<RingNum value={`${Math.round(protein.totalProtein)}g`} sub={`/ ${proTarget}`} />}
          />
          <Ring
            value={protein.totalFiber}
            max={fibTarget}
            size={88}
            color="var(--color-water)"
            label="fiber"
            center={<RingNum value={`${Math.round(protein.totalFiber)}g`} sub={`/ ${fibTarget}`} />}
          />
        </div>
      </Card>

      <Card delay={80}>
        <SectionLabel>Protein per meal</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          {protein.meals.map((m) => (
            <div key={m.slot} className="text-center">
              <div className="text-base">{mealEmoji[m.slot]}</div>
              <div className={`font-mono text-lg font-semibold ${m.isLowProtein ? "text-warn" : "text-ink"}`}>
                {m.protein}
                <span className="text-[10px] text-muted">g</span>
              </div>
              <div className="text-[10px] capitalize text-faint">{m.slot}</div>
            </div>
          ))}
        </div>
        {protein.lowProteinMeals.length > 0 && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
            ⚠ Lage eiwit ({"<"}25g) bij: {protein.lowProteinMeals.join(", ")}
          </p>
        )}
      </Card>

      <Card delay={120}>
        <SectionLabel>Food log</SectionLabel>
        <FoodLogger entries={entries} />
      </Card>
    </div>
  );
}

function RingNum({ value, sub }: { value: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center leading-none">
      <div className="font-mono text-base font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-[9px] text-faint">{sub}</div>}
    </div>
  );
}
