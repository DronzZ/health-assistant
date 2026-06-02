"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWater, setWeight, setReadiness, setMeasurements } from "@/app/actions/log";

/* shared bits ─────────────────────────────────────────────────────────────── */

function StepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inset flex h-11 w-11 shrink-0 items-center justify-center text-xl font-medium text-ink transition active:scale-90 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
  color = "var(--color-good)",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-40"
      style={{ color, borderColor: `${color}55`, background: `${color}1a` }}
    >
      {children}
    </button>
  );
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <span className="text-xs font-medium text-alert">{msg}</span>;
}

/* Water stepper ───────────────────────────────────────────────────────────── */

export function WaterStepper({ current, target }: { current: number; target: number }) {
  const [ml, setMl] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function bump(delta: number) {
    const next = Math.max(0, ml + delta);
    setMl(next);
    setErr(null);
    start(async () => {
      try {
        await addWater(delta);
        router.refresh();
      } catch {
        setMl((m) => Math.max(0, m - delta));
        setErr("Niet opgeslagen");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-mono text-2xl font-semibold text-water">
          {(ml / 1000).toFixed(2)}
          <span className="ml-0.5 text-sm font-medium text-muted">/ {(target / 1000).toFixed(1)}L</span>
        </div>
        <Err msg={err} />
      </div>
      <div className="flex items-center gap-2">
        <StepBtn onClick={() => bump(-250)} disabled={pending || ml <= 0}>
          –
        </StepBtn>
        <button
          type="button"
          onClick={() => bump(250)}
          disabled={pending}
          className="rounded-xl border border-water/40 bg-water/10 px-3 py-2.5 text-sm font-semibold text-water transition active:scale-95 disabled:opacity-40"
        >
          +250
        </button>
        <button
          type="button"
          onClick={() => bump(500)}
          disabled={pending}
          className="rounded-xl border border-water/40 bg-water/10 px-3 py-2.5 text-sm font-semibold text-water transition active:scale-95 disabled:opacity-40"
        >
          +500
        </button>
      </div>
    </div>
  );
}

/* Weight editor ───────────────────────────────────────────────────────────── */

export function WeightEditor({ current }: { current: number | null }) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    const kg = parseFloat(val.replace(",", "."));
    if (isNaN(kg) || kg <= 0) {
      setErr("Ongeldig");
      return;
    }
    setErr(null);
    start(async () => {
      try {
        await setWeight(Math.round(kg * 100) / 100);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1500);
      } catch {
        setErr("Niet opgeslagen");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="inset flex flex-1 items-center px-3">
        <input
          inputMode="decimal"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="—"
          className="w-full bg-transparent py-2.5 font-mono text-2xl font-semibold text-ink outline-none placeholder:text-faint"
        />
        <span className="text-sm text-muted">kg</span>
      </div>
      <PrimaryBtn onClick={save} disabled={pending}>
        {saved ? "✓" : "Save"}
      </PrimaryBtn>
      <Err msg={err} />
    </div>
  );
}

/* Readiness editor ────────────────────────────────────────────────────────── */

const READINESS = [
  { key: "energy", label: "Energy", color: "var(--color-good)" },
  { key: "soreness", label: "Soreness", color: "var(--color-warn)" },
  { key: "knee_pain", label: "Knee pain", color: "var(--color-alert)" },
  { key: "mood", label: "Mood", color: "var(--color-sleep)" },
] as const;

export function ReadinessEditor({
  initial,
}: {
  initial: { energy?: number | null; soreness?: number | null; knee_pain?: number | null; mood?: number | null };
}) {
  const [vals, setVals] = useState<Record<string, number>>({
    energy: initial.energy ?? 5,
    soreness: initial.soreness ?? 3,
    knee_pain: initial.knee_pain ?? 1,
    mood: initial.mood ?? 5,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    setErr(null);
    start(async () => {
      try {
        await setReadiness({
          energy: vals.energy,
          soreness: vals.soreness,
          knee_pain: vals.knee_pain,
          mood: vals.mood,
        });
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1500);
      } catch {
        setErr("Niet opgeslagen");
      }
    });
  }

  return (
    <div className="space-y-3">
      {READINESS.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">{r.label}</span>
            <span className="font-mono font-semibold" style={{ color: r.color }}>
              {vals[r.key]}/10
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={vals[r.key]}
            onChange={(e) => setVals((v) => ({ ...v, [r.key]: Number(e.target.value) }))}
            className="w-full accent-current"
            style={{ accentColor: r.color }}
          />
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <PrimaryBtn onClick={save} disabled={pending}>
          {saved ? "✓ Opgeslagen" : "Log readiness"}
        </PrimaryBtn>
        <Err msg={err} />
      </div>
    </div>
  );
}

/* Measurements editor ─────────────────────────────────────────────────────── */

const FIELDS = [
  { key: "waist_cm", label: "Waist" },
  { key: "hips_cm", label: "Hips" },
  { key: "chest_cm", label: "Chest" },
  { key: "left_arm_cm", label: "L arm" },
  { key: "right_arm_cm", label: "R arm" },
  { key: "left_thigh_cm", label: "L thigh" },
  { key: "right_thigh_cm", label: "R thigh" },
] as const;

export function MeasurementsEditor({ latest }: { latest: Record<string, number | null> | null }) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, latest?.[f.key] != null ? String(latest[f.key]) : ""]))
  );
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    const payload: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const n = parseFloat(vals[f.key].replace(",", "."));
      payload[f.key] = isNaN(n) ? null : n;
    }
    setErr(null);
    start(async () => {
      try {
        await setMeasurements(payload);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 1500);
      } catch {
        setErr("Niet opgeslagen");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="inset flex items-center gap-2 px-3 py-2">
            <span className="w-14 text-xs text-muted">{f.label}</span>
            <input
              inputMode="decimal"
              value={vals[f.key]}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder="—"
              className="w-full bg-transparent font-mono text-base text-ink outline-none placeholder:text-faint"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <PrimaryBtn onClick={save} disabled={pending}>
          {saved ? "✓ Opgeslagen" : "Save measurements"}
        </PrimaryBtn>
        <Err msg={err} />
      </div>
    </div>
  );
}
