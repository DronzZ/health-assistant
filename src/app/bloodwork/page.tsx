export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Card, SectionLabel } from "@/components/charts";

const statusColor: Record<string, string> = {
  optimal: "var(--color-good)",
  normal: "var(--color-sleep)",
  suboptimal: "var(--color-warn)",
  deficient: "var(--color-alert)",
  high: "#fb9b4b",
};

function Pill({ status }: { status: string }) {
  const c = statusColor[status] ?? "var(--color-muted)";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ color: c, background: `${c}1f` }}
    >
      {status}
    </span>
  );
}

export default async function BloodworkPage() {
  const { data } = await db.from("bloodwork").select("*").order("date", { ascending: false }).order("marker");
  const entries = data ?? [];

  const byDate: Record<string, typeof entries> = {};
  for (const e of entries) {
    (byDate[e.date] ??= []).push(e);
  }
  const dates = Object.keys(byDate).sort().reverse();
  const latest = dates[0];
  const flagged = (latest ? byDate[latest] : []).filter((e) => e.status === "deficient" || e.status === "high");

  return (
    <div className="space-y-4">
      <header className="rise pb-1">
        <h1 className="text-2xl font-bold tracking-tight">Bloodwork</h1>
        <p className="text-xs text-muted">Stuur een foto in Telegram om markers toe te voegen</p>
      </header>

      {flagged.length > 0 && (
        <Card delay={40} className="border-alert/30">
          <SectionLabel>Needs attention</SectionLabel>
          <div className="space-y-2">
            {flagged.map((e) => (
              <div key={e.id} className="flex items-center justify-between">
                <span className="text-sm text-ink">{e.marker}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">
                    {e.value} {e.unit}
                  </span>
                  <Pill status={e.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {dates.length === 0 ? (
        <Card delay={40}>
          <p className="py-4 text-center text-sm text-muted">Nog geen bloedwaarden geüpload.</p>
        </Card>
      ) : (
        dates.map((date, i) => (
          <Card key={date} delay={60 + i * 30}>
            <SectionLabel>{date}</SectionLabel>
            <div className="divide-y divide-white/5">
              {byDate[date].map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm text-ink">{e.marker}</div>
                    {e.reference_range && <div className="text-[11px] text-faint">ref: {e.reference_range}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-ink">
                      {e.value} {e.unit}
                    </span>
                    {e.status && <Pill status={e.status} />}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
