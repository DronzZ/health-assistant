import { db } from "./db";

export interface PainTrend {
  avgScore: number;
  maxScore: number;
  recentEntries: { date: string; pain_score: number; activity_context: string | null }[];
  trending: "improving" | "worsening" | "stable";
  runningCorrelation: string;
}

export async function getKneePainTrend(): Promise<PainTrend | null> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data } = await db
    .from("pain_log")
    .select("date, pain_score, activity_context, pain_type, notes")
    .ilike("location", "%knee%")
    .gte("date", fourteenDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (!data?.length) return null;

  const scores = data.map((d) => d.pain_score ?? 0);
  const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const maxScore = Math.max(...scores);

  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const trending: PainTrend["trending"] =
    diff < -0.5 ? "improving" : diff > 0.5 ? "worsening" : "stable";

  const runningEntries = data.filter(
    (d) => d.activity_context && /run/i.test(d.activity_context)
  );
  const runningCorrelation =
    runningEntries.length > 0
      ? `Pain reported after running on ${runningEntries.length} occasion(s)`
      : "No running-related pain logged in this period";

  return {
    avgScore,
    maxScore,
    recentEntries: data.slice(-7).map((d) => ({
      date: d.date,
      pain_score: d.pain_score,
      activity_context: d.activity_context,
    })),
    trending,
    runningCorrelation,
  };
}
