// Centralised date helpers.
//
// The app is single-user and lives in Europe/Brussels. All "what day is it"
// logic MUST use that timezone rather than the server's UTC clock — on Vercel
// the server runs in UTC, so `new Date().toISOString().split("T")[0]` rolls the
// day over at 01:00/02:00 local time and late-evening logs land on the wrong
// calendar day. Use these helpers everywhere instead.

const TZ = "Europe/Brussels";

// en-CA formats as YYYY-MM-DD, which matches the `date` columns in Supabase.
const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Europe/Brussels as `YYYY-MM-DD`. */
export function todayString(): string {
  return dateFmt.format(new Date());
}

/** The date `days` before today (Brussels) as `YYYY-MM-DD`. */
export function dateStringDaysAgo(days: number): string {
  return dateFmt.format(new Date(Date.now() - days * 86_400_000));
}

/** Yesterday's date in Europe/Brussels as `YYYY-MM-DD`. */
export function yesterdayString(): string {
  return dateStringDaysAgo(1);
}
