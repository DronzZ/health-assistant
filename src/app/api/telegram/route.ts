import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  isAllowedChat,
  isCompressedPhoto,
  isPhotoFile,
  downloadFileAsBase64,
  sendMessage,
  type TelegramUpdate,
  type TelegramMessage,
} from "@/lib/telegram";
import { handleConversation } from "@/lib/trainer";
import { parseFoodLabel, extractGrams } from "@/lib/food-parser";
import { analyzeProgressPhoto } from "@/lib/progress-analyzer";
import { analyzeBloodwork } from "@/lib/bloodwork-analyzer";
import { db } from "@/lib/db";
import { lookupFood } from "@/lib/food-lookup";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Respond immediately � Telegram requires a response within 5 seconds
  const body = await req.json() as TelegramUpdate;

  waitUntil(processUpdate(body));

  return NextResponse.json({ ok: true });
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  // Security: only respond to the configured Telegram user
  if (!isAllowedChat(message.chat.id)) return;

  try {
    // Route based on message type
    if (message.photo || message.document) {
      await handleMediaMessage(message);
    } else if (message.text) {
      await handleTextMessage(message);
    }
  } catch (error) {
    console.error("Error processing Telegram message:", error);
    await sendMessage("?? Something went wrong processing your message. Try again.");
  }
}

async function handleMediaMessage(message: TelegramMessage): Promise<void> {
  const caption = (message.caption ?? "").toLowerCase();

  // Progress photo: must be sent as a file, not a compressed photo
  if (caption.includes("/progress") || caption.includes("progress")) {
    if (isCompressedPhoto(message)) {
      await sendMessage(
        "?? Please resend this as a *file/document*, not as a photo.\n\nIn Telegram: tap the ?? paperclip ? *File* ? select your photo.\n\nThis keeps full quality for analysis."
      );
      return;
    }

    if (isPhotoFile(message) && message.document) {
      const base64 = await downloadFileAsBase64(message.document.file_id);
      const mimeType = message.document.mime_type ?? "image/jpeg";
      const fileBuffer = Buffer.from(base64, "base64");
      await analyzeProgressPhoto(base64, mimeType, fileBuffer, Math.round(message.document.file_size / 1024));
    }
    return;
  }

  // Bloodwork photo (any format accepted)
  if (caption.includes("blood") || caption.includes("lab") || caption.includes("results")) {
    const fileId = message.document?.file_id ?? message.photo?.slice(-1)[0]?.file_id;
    if (fileId) {
      const mimeType = message.document?.mime_type ?? "image/jpeg";
      await sendMessage("?? Analysing your bloodwork with Opus... this takes a moment.");
      const base64 = await downloadFileAsBase64(fileId);
      await analyzeBloodwork(base64, mimeType);
    }
    return;
  }

  // Nutrition label photo: any photo with a gram mention in the caption
  const gramsFromCaption = caption ? extractGrams(caption) : null;
  if (gramsFromCaption && (message.photo || message.document)) {
    const fileId = message.document?.file_id ?? message.photo?.slice(-1)[0]?.file_id;
    const mimeType = message.document?.mime_type ?? "image/jpeg";
    if (fileId) {
      const base64 = await downloadFileAsBase64(fileId);
      const macros = await parseFoodLabel(base64, mimeType, gramsFromCaption);
      const today = new Date().toISOString().split("T")[0];
      await db.from("food_entries").insert({
        date: today,
        name: macros.name,
        grams_eaten: macros.grams,
        calories: macros.calories,
        protein_g: macros.protein_g,
        carbs_g: macros.carbs_g,
        fat_g: macros.fat_g,
        fiber_g: macros.fiber_g,
        meal_slot: "snack",
        source: "photo_label",
      });
      await sendMessage(
        `? Logged (label scan): *${macros.name}* � ${macros.grams}g\n` +
        `� ${macros.calories} kcal | ${macros.protein_g}g protein | ${macros.carbs_g}g carbs | ${macros.fat_g}g fat | ${macros.fiber_g}g fiber`
      );
    }
    return;
  }

  // Unrecognised photo
  await sendMessage("Photo received. Add a caption to tell me what this is:\n� `200g` (nutrition label)\n� `/progress` (body photo � send as file)\n� `blood results` (bloodwork)");
}

async function handleTextMessage(message: TelegramMessage): Promise<void> {
  const text = message.text!.trim();
  const today = new Date().toISOString().split("T")[0];

  // Ensure daily_logs row exists
  await db.from("daily_logs").upsert({ date: today }, { onConflict: "date", ignoreDuplicates: true });

  // Quick command shortcuts
  if (text.startsWith("/water ")) {
    const litres = parseFloat(text.replace("/water ", ""));
    if (!isNaN(litres)) {
      const ml = Math.round(litres * 1000);
      const { data } = await db.from("daily_logs").select("water_ml").eq("date", today).single();
      await db.from("daily_logs").update({ water_ml: (data?.water_ml ?? 0) + ml }).eq("date", today);
      await sendMessage(`?? Logged ${litres}L water. Total today: ${((data?.water_ml ?? 0) + ml) / 1000}L`);
      return;
    }
  }

  if (text.startsWith("/weight ")) {
    const kg = parseFloat(text.replace("/weight ", ""));
    if (!isNaN(kg)) {
      await db.from("daily_logs").update({ weight_kg: kg }).eq("date", today);
      await sendMessage(`?? Weight logged: ${kg} kg`);
      return;
    }
  }

  if (text.startsWith("/readiness ")) {
    const parts = text.replace("/readiness ", "").split(/\s+/).map(Number);
    const [energy, soreness, knee_pain, mood] = parts;
    await db.from("daily_logs").update({
      morning_energy: energy ?? null,
      morning_soreness: soreness ?? null,
      morning_knee_pain: knee_pain ?? null,
      morning_mood: mood ?? null,
    }).eq("date", today);
    const kneeWarning = knee_pain >= 7 ? "\n?? Knee pain at 7+. No running today." : "";
    await sendMessage(`? Readiness logged: energy ${energy}/10, soreness ${soreness}/10, knee ${knee_pain}/10, mood ${mood}/10${kneeWarning}`);
    return;
  }

  if (text.startsWith("/supplements ")) {
    const sups = text.replace("/supplements ", "").split(",").map((s) => s.trim());
    const { data } = await db.from("daily_logs").select("supplements").eq("date", today).single();
    const merged = [...new Set([...(data?.supplements ?? []), ...sups])];
    await db.from("daily_logs").update({ supplements: merged }).eq("date", today);
    await sendMessage(`?? Supplements logged: ${sups.join(", ")}`);
    return;
  }

  if (text.startsWith("/food ")) {
    const query = text.replace("/food ", "");
    const results = await lookupFood(query);
    for (const item of results) {
      await db.from("food_entries").insert({
        date: today,
        name: item.name,
        grams_eaten: item.grams,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: item.fiber_g,
        meal_slot: "snack",
        source: item.source,
      });
    }
    const lines = results.map(
      (r) => `${r.warning ? r.warning + "\n" : ""}? *${r.name}* (${r.grams}g): ${r.calories}kcal | ${r.protein_g}g protein | ${r.fiber_g}g fiber`
    );
    await sendMessage(lines.join("\n\n"));
    return;
  }

  if (text === "/today") {
    const [dailyRes, foodRes, garminRes] = await Promise.all([
      db.from("daily_logs").select("*").eq("date", today).single(),
      db.from("food_entries").select("*").eq("date", today),
      db.from("garmin_data").select("*").eq("date", today).single(),
    ]);
    const daily = dailyRes.data;
    const food = foodRes.data ?? [];
    const garmin = garminRes.data;
    const totalCals = food.reduce((s: number, f: any) => s + f.calories, 0);
    const totalProtein = food.reduce((s: number, f: any) => s + f.protein_g, 0);
    const totalFiber = food.reduce((s: number, f: any) => s + f.fiber_g, 0);

    await sendMessage(
      `?? *Today � ${today}*\n\n` +
      `?? Water: ${daily?.water_ml ?? 0}ml\n` +
      `?? Weight: ${daily?.weight_kg ?? "not logged"} kg\n` +
      `?? Calories: ${Math.round(totalCals)} kcal\n` +
      `?? Protein: ${Math.round(totalProtein)}g\n` +
      `?? Fiber: ${Math.round(totalFiber)}g\n` +
      `?? Sleep score: ${garmin?.sleep_score ?? "no data"}\n` +
      `?? Steps: ${garmin?.steps ?? "no data"}\n` +
      `?? Body Battery: ${garmin?.body_battery_end ?? "no data"}\n` +
      `?? Supplements: ${daily?.supplements?.join(", ") || "none"}`
    );
    return;
  }

  if (text.startsWith("/workout ")) {
    const input = text.slice("/workout ".length);
    const entries = input.split(",").map((s) => s.trim()).filter(Boolean);
    const rows: { date: string; exercise: string; set_number: number; reps: number; weight_kg: number }[] = [];
    const summary: string[] = [];

    for (const entry of entries) {
      const match = entry.match(/^(.+?)\s+(\d+)x(\d+)\s+([\d.]+)(?:kg)?$/i);
      if (!match) {
        await sendMessage(`Kon niet parsen: "${entry}"\nFormat: oefening 3x8 80kg`);
        return;
      }
      const [, name, setsStr, repsStr, weightStr] = match;
      const sets = parseInt(setsStr, 10);
      const reps = parseInt(repsStr, 10);
      const weight = parseFloat(weightStr);
      for (let i = 1; i <= sets; i++) {
        rows.push({ date: today, exercise: name.toLowerCase().trim(), set_number: i, reps, weight_kg: weight });
      }
      summary.push(`${name}: ${sets}×${reps} @ ${weight}kg`);
    }

    await db.from("workouts").insert(rows);
    await sendMessage(`✅ Workout gelogd:\n${summary.map((s) => `• ${s}`).join("\n")}`);
    return;
  }

  if (text === "/measure") {
    await sendMessage(
      "?? *Monthly measurements* � reply with your values:\n\n" +
      "Format: `waist hips chest left-arm right-arm left-thigh right-thigh` (all in cm)\n\n" +
      "Example: `82 95 100 35 35 58 58`"
    );
    return;
  }

  // Check if message looks like measurement values (7 numbers)
  const nums = text.split(/\s+/).map(Number).filter((n) => !isNaN(n));
  if (nums.length === 7 && nums.every((n) => n > 0 && n < 200)) {
    const [waist, hips, chest, left_arm, right_arm, left_thigh, right_thigh] = nums;
    await db.from("body_measurements").insert({ date: today, waist_cm: waist, hips_cm: hips, chest_cm: chest, left_arm_cm: left_arm, right_arm_cm: right_arm, left_thigh_cm: left_thigh, right_thigh_cm: right_thigh });
    await sendMessage(`?? Measurements saved:\nWaist: ${waist}cm | Hips: ${hips}cm | Chest: ${chest}cm\nArms: ${left_arm}/${right_arm}cm | Thighs: ${left_thigh}/${right_thigh}cm`);
    return;
  }

  // Everything else ? conversational trainer
  await handleConversation(text);
}
