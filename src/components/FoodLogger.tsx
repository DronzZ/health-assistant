"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFood, deleteFood } from "@/app/actions/log";

type Entry = {
  id: string;
  name: string;
  calories: number;
  protein_g: number | null;
  fiber_g: number | null;
  grams_eaten: number | null;
  meal_slot: string;
};

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function FoodLogger({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>("breakfast");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function add() {
    const calories = parseFloat(kcal.replace(",", "."));
    if (!name.trim() || isNaN(calories)) {
      setErr("Naam + kcal verplicht");
      return;
    }
    setErr(null);
    start(async () => {
      try {
        await addFood({
          name: name.trim(),
          calories,
          protein_g: parseFloat(protein.replace(",", ".")) || 0,
          fiber_g: parseFloat(fiber.replace(",", ".")) || 0,
          meal_slot: slot,
        });
        setName("");
        setKcal("");
        setProtein("");
        setFiber("");
        router.refresh();
      } catch {
        setErr("Niet opgeslagen");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      try {
        await deleteFood(id);
        router.refresh();
      } catch {
        setErr("Verwijderen mislukt");
      }
    });
  }

  return (
    <div className="space-y-3">
      {SLOTS.map((s) => {
        const items = entries.filter((e) => e.meal_slot === s);
        if (items.length === 0) return null;
        return (
          <div key={s}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
              {SLOT_LABEL[s]}
            </div>
            <div className="divide-y divide-white/5">
              {items.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">
                      {e.name}
                      {e.grams_eaten ? <span className="ml-1 text-xs text-faint">{e.grams_eaten}g</span> : null}
                    </div>
                    <div className="font-mono text-xs text-muted">
                      {Math.round(e.calories)} kcal · {Math.round(e.protein_g ?? 0)}p · {Math.round(e.fiber_g ?? 0)}f
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    disabled={pending}
                    aria-label="Delete"
                    className="shrink-0 rounded-lg px-2 py-1 text-faint transition hover:text-alert disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {entries.length === 0 && !open && (
        <p className="py-2 text-sm text-muted">Nog niks gelogd vandaag.</p>
      )}

      {open ? (
        <div className="inset space-y-2.5 p-3">
          <div className="flex gap-1">
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                  slot === s ? "bg-pro/20 text-pro" : "text-faint"
                }`}
              >
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wat heb je gegeten?"
            className="w-full rounded-lg bg-black/30 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint"
          />
          <div className="grid grid-cols-3 gap-2">
            <NumIn value={kcal} set={setKcal} label="kcal" />
            <NumIn value={protein} set={setProtein} label="protein" />
            <NumIn value={fiber} set={setFiber} label="fiber" />
          </div>
          {err && <p className="text-xs font-medium text-alert">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="flex-1 rounded-xl border border-pro/40 bg-pro/15 py-2.5 text-sm font-semibold text-pro transition active:scale-95 disabled:opacity-40"
            >
              {pending ? "…" : "Toevoegen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setErr(null);
              }}
              className="rounded-xl px-4 py-2.5 text-sm text-muted"
            >
              Sluit
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-dashed border-hairline py-2.5 text-sm font-medium text-muted transition hover:text-ink"
        >
          + Eten toevoegen
        </button>
      )}
    </div>
  );
}

function NumIn({ value, set, label }: { value: string; set: (v: string) => void; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-faint">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder="0"
        className="w-full rounded-lg bg-black/30 px-2.5 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}
