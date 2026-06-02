import type { ReactNode, CSSProperties } from "react";

/* Layout helpers ─────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section className={`glass rise p-4 ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">{children}</div>
  );
}

/** A big mono readout: number + unit, with a caption underneath. */
export function Readout({
  value,
  unit,
  caption,
  color = "var(--color-ink)",
  size = "text-3xl",
}: {
  value: ReactNode;
  unit?: string;
  caption?: string;
  color?: string;
  size?: string;
}) {
  return (
    <div className="flex flex-col">
      <div className={`font-mono ${size} font-semibold leading-none`} style={{ color }}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-muted">{unit}</span>}
      </div>
      {caption && <div className="mt-1.5 text-[11px] text-muted">{caption}</div>}
    </div>
  );
}

/* Progress ring ──────────────────────────────────────────────────────────── */

export function Ring({
  value,
  max,
  size = 92,
  stroke = 8,
  color = "var(--color-good)",
  label,
  center,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  center?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      {label && <div className="text-[11px] font-medium text-muted">{label}</div>}
    </div>
  );
}

/* Recovery / readiness gauge (semicircular dome) ──────────────────────────── */

export function Gauge({
  value,
  size = 184,
  label = "Readiness",
}: {
  value: number | null;
  size?: number;
  label?: string;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arc = Math.PI * r; // length of the upper semicircle
  const pct = value != null ? Math.min(1, Math.max(0, value / 100)) : 0;
  const offset = arc * (1 - pct);
  const path = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`;
  const h = cy + stroke;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <defs>
          <linearGradient id="gaugegrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-alert)" />
            <stop offset="50%" stopColor="var(--color-warn)" />
            <stop offset="100%" stopColor="var(--color-good)" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={path}
          fill="none"
          stroke="url(#gaugegrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="-mt-10 flex flex-col items-center">
        <div className="font-mono text-4xl font-bold leading-none">{value ?? "—"}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">{label}</div>
      </div>
    </div>
  );
}

/* Sparkline / trend line ──────────────────────────────────────────────────── */

export function Sparkline({
  data,
  color = "var(--color-ink)",
  avg,
  width = 320,
  height = 72,
  unit = "",
}: {
  data: number[];
  color?: string;
  avg?: number[];
  width?: number;
  height?: number;
  unit?: string;
}) {
  const pts = data.filter((n) => typeof n === "number" && !isNaN(n));
  if (pts.length < 2) {
    return <div className="py-6 text-center text-xs text-faint">Not enough data yet</div>;
  }

  const all = avg ? [...pts, ...avg.filter((n) => !isNaN(n))] : pts;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.12 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const pb = 6;

  const x = (i: number, len: number) => (i / (len - 1)) * (width - pb * 2) + pb;
  const y = (v: number) => height - pb - ((v - lo) / (hi - lo)) * (height - pb * 2);

  const line = (arr: number[]) => arr.map((v, i) => `${x(i, arr.length)},${y(v)}`).join(" ");
  const area = `${line(pts)} ${x(pts.length - 1, pts.length)},${height} ${x(0, pts.length)},${height}`;
  const last = pts[pts.length - 1];

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${color.replace(/[^a-z]/gi, "")})`} />
      {avg && avg.length === pts.length && (
        <polyline
          points={line(avg)}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={line(pts)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(pts.length - 1, pts.length)} cy={y(last)} r={3} fill={color} />
      <title>{`Latest: ${last}${unit}`}</title>
    </svg>
  );
}

/* Linear progress bar (for inline macro/water readouts) ───────────────────── */

export function Bar({
  value,
  max,
  color = "var(--color-good)",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </div>
  );
}
