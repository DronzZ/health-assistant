"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { saveMealItem, deleteMealItem, type MealItemInput } from "@/app/actions/mealplan";

type Item = {
  id: string;
  day_of_week: number;
  meal_slot: string;
  food_item: string;
  target_grams: number | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fiber_per_100g: number | null;
  is_refeed_day: boolean | null;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
const SLOT_LABEL: Record<string, string> = { breakfast: "🌅 Breakfast", lunch: "☀️ Lunch", dinner: "🌙 Dinner", snack: "🍎 Snack" };

function kcalOf(i: Item) {
  return i.target_grams && i.kcal_per_100g ? Math.round((i.target_grams * i.kcal_per_100g) / 100) : null;
}
function proOf(i: Item) {
  return i.target_grams && i.protein_per_100g ? Math.round((i.target_grams * i.protein_per_100g) / 100) : null;
}

const blank = (day: number): MealItemInput => ({
  day_of_week: day,
  meal_slot: "breakfast",
  food_item: "",
  target_grams: null,
  kcal_per_100g: null,
  protein_per_100g: null,
  fiber_per_100g: null,
  is_refeed_day: false,
});

export function MealPlanEditor({ items, todayIndex }: { items: Item[]; todayIndex: number }) {
  const [form, setForm] = useState<MealItemInput | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const byDay: Record<number, Item[]> = {};
  for (const it of items) (byDay[it.day_of_week] ??= []).push(it);

  function save() {
    if (!form || !form.food_item.trim()) {
      setErr("Naam verplicht");
      return;
    }
    setErr(null);
    start(async () => {
      try {
        await saveMealItem({ ...form, food_item: form.food_item.trim() });
        setForm(null);
        router.refresh();
      } catch {
        setErr("Niet opgeslagen");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      try {
        await deleteMealItem(id);
        router.refresh();
      } catch {
        setErr("Verwijderen mislukt");
      }
    });
  }

  return (
    <div className="space-y-4">
      {DAYS.map((dayLabel, dayIdx) => {
        const dayItems = byDay[dayIdx] ?? [];
        const isToday = dayIdx === todayIndex;
        const totalKcal = dayItems.reduce((s, i) => s + (kcalOf(i) ?? 0), 0);
        const totalPro = dayItems.reduce((s, i) => s + (proOf(i) ?? 0), 0);

        return (
          <section key={dayIdx} className={`glass rise p-4 ${isToday ? "ring-1 ring-pro/40" : ""}`} style={{ "--d": `${dayIdx * 35}ms` } as CSSProperties}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{dayLabel}</h2>
                {isToday && <span className="rounded-full bg-pro/20 px-2 py-0.5 text-[10px] font-semibold text-pro">Today</span>}
                {dayItems.some((i) => i.is_refeed_day) && (
                  <span className="rounded-full bg-steps/20 px-2 py-0.5 text-[10px] font-semibold text-steps">Refeed</span>
                )}
              </div>
              {totalKcal > 0 && (
                <span className="font-mono text-[11px] text-faint">
                  {totalKcal} kcal · {totalPro}g pro
                </span>
              )}
            </div>

            <div className="space-y-3">
              {SLOTS.map((slot) => {
                const slotItems = dayItems.filter((i) => i.meal_slot === slot);
                if (slotItems.length === 0) return null;
                return (
                  <div key={slot}>
                    <div className="mb-1 text-[11px] text-faint">{SLOT_LABEL[slot]}</div>
                    <div className="space-y-1">
                      {slotItems.map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                id: i.id,
                                day_of_week: i.day_of_week,
                                meal_slot: i.meal_slot as MealItemInput["meal_slot"],
                                food_item: i.food_item,
                                target_grams: i.target_grams,
                                kcal_per_100g: i.kcal_per_100g,
                                protein_per_100g: i.protein_per_100g,
                                fiber_per_100g: i.fiber_per_100g,
                                is_refeed_day: i.is_refeed_day ?? false,
                              })
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="text-sm text-ink">{i.food_item}</span>
                            {i.target_grams ? <span className="ml-1 text-xs text-faint">{i.target_grams}g</span> : null}
                          </button>
                          <span className="font-mono text-[11px] text-muted">
                            {kcalOf(i) ?? "—"} kcal
                          </span>
                          <button
                            type="button"
                            onClick={() => remove(i.id)}
                            disabled={pending}
                            aria-label="Delete"
                            className="text-faint transition hover:text-alert disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setForm(blank(dayIdx))}
              className="mt-3 w-full rounded-xl border border-dashed border-hairline py-2 text-xs font-medium text-muted transition hover:text-ink"
            >
              + Item op {dayLabel}
            </button>
          </section>
        );
      })}

      {form && (
        <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="glass space-y-2.5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{form.id ? "Item bewerken" : "Nieuw item"}</span>
              <button type="button" onClick={() => setForm(null)} className="text-muted">
                Sluit
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setForm({ ...form, day_of_week: idx })}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    form.day_of_week === idx ? "bg-pro/20 text-pro" : "inset text-faint"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, meal_slot: s })}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition ${
                    form.meal_slot === s ? "bg-pro/20 text-pro" : "inset text-faint"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              value={form.food_item}
              onChange={(e) => setForm({ ...form, food_item: e.target.value })}
              placeholder="Voedingsmiddel"
              className="w-full rounded-lg bg-black/30 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint"
            />
            <div className="grid grid-cols-4 gap-2">
              <FormNum label="grams" value={form.target_grams} onChange={(v) => setForm({ ...form, target_grams: v })} />
              <FormNum label="kcal/100" value={form.kcal_per_100g} onChange={(v) => setForm({ ...form, kcal_per_100g: v })} />
              <FormNum label="pro/100" value={form.protein_per_100g} onChange={(v) => setForm({ ...form, protein_per_100g: v })} />
              <FormNum label="fib/100" value={form.fiber_per_100g} onChange={(v) => setForm({ ...form, fiber_per_100g: v })} />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={!!form.is_refeed_day}
                onChange={(e) => setForm({ ...form, is_refeed_day: e.target.checked })}
                className="accent-steps"
              />
              Refeed-dag
            </label>
            {err && <p className="text-xs font-medium text-alert">{err}</p>}
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="w-full rounded-xl border border-pro/40 bg-pro/15 py-2.5 text-sm font-semibold text-pro transition active:scale-95 disabled:opacity-40"
            >
              {pending ? "…" : "Opslaan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormNum({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wide text-faint">{label}</span>
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(",", "."));
          onChange(isNaN(n) ? null : n);
        }}
        placeholder="—"
        className="w-full rounded-lg bg-black/30 px-2 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}
