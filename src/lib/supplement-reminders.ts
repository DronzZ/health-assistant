import { db } from "./db";
import { sendMessage } from "./telegram";

export async function sendSupplementReminder(timing: "morning" | "pre-workout" | "evening"): Promise<void> {
  const { data } = await db
    .from("supplement_schedule")
    .select("*")
    .eq("timing", timing);

  if (!data?.length) return;

  const names = data.map((s: any) => s.supplement_name);
  const notes = data.filter((s: any) => s.notes).map((s: any) => `� ${s.supplement_name}: ${s.notes}`);

  const emoji = timing === "morning" ? "??" : timing === "pre-workout" ? "??" : "??";
  const label = timing === "morning" ? "Morning supplements" : timing === "pre-workout" ? "Pre-workout" : "Evening supplements";

  let message = `${emoji} *${label}*\n${names.join(", ")}`;
  if (notes.length) message += `\n\n${notes.join("\n")}`;

  await sendMessage(message);
}
