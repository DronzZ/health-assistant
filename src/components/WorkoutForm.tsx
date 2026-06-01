"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SetEntry {
  reps: number | "";
  weight_kg: number | "";
}

interface ExerciseEntry {
  name: string;
  sets: SetEntry[];
}

export default function WorkoutForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([
    { name: "", sets: [{ reps: "", weight_kg: "" }] },
  ]);
  const [saving, setSaving] = useState(false);

  function addExercise() {
    setExercises([...exercises, { name: "", sets: [{ reps: "", weight_kg: "" }] }]);
  }

  function removeExercise(exIdx: number) {
    setExercises(exercises.filter((_, i) => i !== exIdx));
  }

  function updateName(exIdx: number, name: string) {
    const updated = [...exercises];
    updated[exIdx] = { ...updated[exIdx], name };
    setExercises(updated);
  }

  function addSet(exIdx: number) {
    const updated = [...exercises];
    updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets, { reps: "", weight_kg: "" }] };
    setExercises(updated);
  }

  function removeSet(exIdx: number, setIdx: number) {
    const updated = [...exercises];
    updated[exIdx] = { ...updated[exIdx], sets: updated[exIdx].sets.filter((_, i) => i !== setIdx) };
    setExercises(updated);
  }

  function updateSet(exIdx: number, setIdx: number, field: "reps" | "weight_kg", value: string) {
    const updated = [...exercises];
    const sets = [...updated[exIdx].sets];
    sets[setIdx] = { ...sets[setIdx], [field]: value === "" ? "" : Number(value) };
    updated[exIdx] = { ...updated[exIdx], sets };
    setExercises(updated);
  }

  async function handleSubmit() {
    const valid = exercises.filter(
      (ex) => ex.name.trim() && ex.sets.length > 0 && ex.sets.every((s) => s.reps !== "" && s.weight_kg !== "")
    );
    if (!valid.length) return;

    setSaving(true);
    try {
      await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          exercises: valid.map((ex) => ({
            name: ex.name.trim(),
            sets: ex.sets.map((s) => ({ reps: Number(s.reps), weight_kg: Number(s.weight_kg) })),
          })),
        }),
      });
      setExercises([{ name: "", sets: [{ reps: "", weight_kg: "" }] }]);
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl py-3 text-sm font-medium transition-colors"
      >
        + Log workout
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-white">Log workout</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-xs bg-zinc-800 rounded-lg px-2 py-1.5 text-zinc-300"
        />
      </div>

      {exercises.map((ex, exIdx) => (
        <div key={exIdx} className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Oefening (bv. bench press)"
              value={ex.name}
              onChange={(e) => updateName(exIdx, e.target.value)}
              className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
            {exercises.length > 1 && (
              <button onClick={() => removeExercise(exIdx)} className="text-zinc-500 hover:text-red-400 text-lg px-1">
                ×
              </button>
            )}
          </div>

          <div className="pl-2 space-y-1.5">
            <div className="grid grid-cols-[24px_1fr_1fr_20px] text-xs text-zinc-500 px-1 gap-2">
              <span>#</span>
              <span>Reps</span>
              <span>Gewicht (kg)</span>
              <span />
            </div>
            {ex.sets.map((s, setIdx) => (
              <div key={setIdx} className="grid grid-cols-[24px_1fr_1fr_20px] gap-2 items-center">
                <span className="text-xs text-zinc-500 text-center">{setIdx + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="8"
                  value={s.reps}
                  onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                  className="bg-zinc-800 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="80"
                  value={s.weight_kg}
                  onChange={(e) => updateSet(exIdx, setIdx, "weight_kg", e.target.value)}
                  className="bg-zinc-800 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:ring-1 focus:ring-blue-500"
                />
                {ex.sets.length > 1 ? (
                  <button onClick={() => removeSet(exIdx, setIdx)} className="text-zinc-600 hover:text-red-400 text-lg text-center">
                    ×
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            <button onClick={() => addSet(exIdx)} className="text-xs text-blue-400 hover:text-blue-300 pl-1">
              + Set toevoegen
            </button>
          </div>
        </div>
      ))}

      <button onClick={addExercise} className="text-sm text-zinc-400 hover:text-white transition-colors">
        + Oefening toevoegen
      </button>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2.5 text-sm transition-colors"
        >
          Annuleren
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
        >
          {saving ? "Opslaan..." : "Workout opslaan"}
        </button>
      </div>
    </div>
  );
}
