export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";

const statusColor: Record<string, string> = {
  optimal: "bg-green-900/50 text-green-400",
  normal: "bg-blue-900/50 text-blue-400",
  suboptimal: "bg-yellow-900/50 text-yellow-400",
  deficient: "bg-red-900/50 text-red-400",
  high: "bg-orange-900/50 text-orange-400",
};

export default async function BloodworkPage() {
  const { data } = await db
    .from("bloodwork")
    .select("*")
    .order("date", { ascending: false })
    .order("marker");

  const entries = data ?? [];

  // Group by date
  const byDate: Record<string, typeof entries> = {};
  for (const e of entries) {
    byDate[e.date] = byDate[e.date] ?? [];
    byDate[e.date].push(e);
  }

  const dates = Object.keys(byDate).sort().reverse();
  const latest = dates[0];
  const latestEntries = latest ? byDate[latest] : [];
  const deficient = latestEntries.filter((e) => e.status === "deficient" || e.status === "high");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Bloodwork</h1>

      {/* Action items */}
      {deficient.length > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
          <div className="text-sm font-medium text-red-400 mb-2">Needs attention</div>
          <div className="space-y-1">
            {deficient.map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-zinc-300">{e.marker}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[e.status] ?? ""}`}>
                  {e.value} {e.unit} â€” {e.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full results by date */}
      {dates.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-6 text-center text-zinc-500 text-sm">
          <p>No bloodwork uploaded yet.</p>
          <p className="mt-1">Send a photo of your blood test results in Telegram.</p>
        </div>
      ) : (
        dates.map((date) => (
          <div key={date} className="bg-zinc-900 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-300">
              {date}
            </div>
            <div className="divide-y divide-zinc-800">
              {byDate[date].map((e) => (
                <div key={e.id} className="flex justify-between items-center px-4 py-3">
                  <div>
                    <div className="text-sm">{e.marker}</div>
                    {e.reference_range && (
                      <div className="text-xs text-zinc-600">ref: {e.reference_range}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {e.value} {e.unit}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[e.status] ?? "bg-zinc-800 text-zinc-400"}`}>
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

