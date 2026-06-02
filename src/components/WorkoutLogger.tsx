"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWorkoutSets, deleteWorkoutExercise } from "@/app/actions/log";

type Logged = { exercise: string; sets: { reps: number; weight_kg: number }[] };

export function WorkoutLogger({ date, logged }: { date: string; logged: Logged[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(40);
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function log() {
    if (!name.trim()) {
      setErr("Naam verplicht");
      return;
    }
    setErr(null);
    start(async () => {
      try {
        await logWorkoutSets({
          exercise: name.trim(),
          sets: Array.from({ length: sets }, () => ({ reps, weight_kg: weight })),
        });
        setName("");
        router.refresh();
      } catch {
        setErr("Niet opgeslagen");
      }
    });
  }

  function remove(exercise: string) {
    start(async () => {
      try {
        await deleteWorkoutExercise(date, exercise);
        router.refresh();
      } catch {
        setErr("Verwijderen mislukt");
      }
    });
  }

  return (
    <div className="space-y-3">
      {logged.length > 0 && (
        <div className="divide-y divide-white/5">
          {logged.map((w) => {
            const top = Math.max(...w.sets.map((s) => s.weight_kg));
            return (
              <div key={w.exercise} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium capitalize text-ink">{w.exercise}</div>
                  <div className="font-mono text-xs text-muted">
                    {w.sets.map((s) => `${s.weight_kg}×${s.reps}`).join("  ·  ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-faint">{top}kg top</span>
                  <button
                    type="button"
                    onClick={() => remove(w.exercise)}
                    disabled={pending}
                    aria-label="Delete"
                    className="rounded-lg px-2 py-1 text-faint transition hover:text-alert disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <div className="inset space-y-3 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Oefening (bv. bench press)"
            className="w-full rounded-lg bg-black/30 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint"
          />
          <Stepper label="Weight" unit="kg" value={weight} step={2.5} min={0} onChange={setWeight} />
          <Stepper label="Reps" value={reps} step={1} min={1} onChange={setReps} />
          <Stepper label="Sets" value={sets} step={1} min={1} onChange={setSets} />
          {err && <p className="text-xs font-medium text-alert">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={log}
              disabled={pending}
              className="flex-1 rounded-xl border border-steps/40 bg-steps/15 py-2.5 text-sm font-semibold text-steps transition active:scale-95 disabled:opacity-40"
            >
              {pending ? "…" : `Log ${sets}×${reps} @ ${weight}kg`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted">
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
          + Set loggen
        </button>
      )}
    </div>
  );
}

function Stepper({
  label,
  unit,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
          className="inset flex h-9 w-9 items-center justify-center text-lg text-ink active:scale-90"
        >
          –
        </button>
        <span className="w-16 text-center font-mono text-lg font-semibold text-ink">
          {value}
          {unit && <span className="text-xs text-muted">{unit}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.round((value + step) * 100) / 100)}
          className="inset flex h-9 w-9 items-center justify-center text-lg text-ink active:scale-90"
        >
          +
        </button>
      </div>
    </div>
  );
}
