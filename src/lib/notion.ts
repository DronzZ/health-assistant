import { db } from "./db";
import { sendMessage } from "./telegram";

const NOTION_API = "https://api.notion.com/v1";
const headers = () => ({
  Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
});

async function notionRequest(path: string, method: string, body?: unknown): Promise<any> {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function richText(text: string) {
  return [{ type: "rich_text", rich_text: [{ type: "text", text: { content: String(text ?? "") } }] }];
}

function titleProp(text: string) {
  return { title: [{ type: "text", text: { content: String(text ?? "") } }] };
}

function numberProp(val: number | null | undefined) {
  return { number: val ?? null };
}

function selectProp(val: string | null | undefined) {
  return val ? { select: { name: String(val) } } : { select: null };
}

function dateProp(val: string | null | undefined) {
  return val ? { date: { start: val } } : { date: null };
}

export async function syncToNotion(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  try {
    const [dailyRes, foodRes, garminRes, workoutRes, supplementRes] = await Promise.all([
      db.from("daily_logs").select("*").eq("date", today).single(),
      db.from("food_entries").select("*").eq("date", today),
      db.from("garmin_data").select("*").eq("date", today).single(),
      db.from("workouts").select("*").eq("date", today),
      db.from("supplement_schedule").select("*"),
    ]);

    const daily = dailyRes.data;
    const food = foodRes.data ?? [];
    const garmin = garminRes.data;
    const workouts = workoutRes.data ?? [];

    const totalCals = food.reduce((s: number, f: any) => s + (f.calories ?? 0), 0);
    const totalProtein = food.reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0);
    const totalFiber = food.reduce((s: number, f: any) => s + (f.fiber_g ?? 0), 0);

    // Daily log page
    if (process.env.NOTION_DAILY_LOG_DB_ID) {
      await sleep(350); // Notion rate limit: 3 req/s
      await notionRequest("/pages", "POST", {
        parent: { database_id: process.env.NOTION_DAILY_LOG_DB_ID },
        properties: {
          Name: titleProp(today),
          Date: dateProp(today),
          "Water (ml)": numberProp(daily?.water_ml),
          "Weight (kg)": numberProp(daily?.weight_kg),
          "Calories": numberProp(Math.round(totalCals)),
          "Protein (g)": numberProp(Math.round(totalProtein)),
          "Fiber (g)": numberProp(Math.round(totalFiber)),
          "Steps": numberProp(garmin?.steps),
          "Sleep Score": numberProp(garmin?.sleep_score),
          "Body Battery": numberProp(garmin?.body_battery_end),
          "HRV": numberProp(garmin?.hrv_last_night),
          "Energy": numberProp(daily?.morning_energy),
          "Soreness": numberProp(daily?.morning_soreness),
          "Knee Pain": numberProp(daily?.morning_knee_pain),
          "Mood": numberProp(daily?.morning_mood),
          "Workout": workouts.length
            ? richText([...new Set(workouts.map((w: any) => w.exercise))].slice(0, 3).join(", "))[0]
            : richText("Rest")[0],
        },
      });
    }

    // Meal entries (one page per food entry to keep macros per item)
    if (process.env.NOTION_MEAL_PLAN_DB_ID && food.length > 0) {
      for (const entry of food) {
        await sleep(350);
        await notionRequest("/pages", "POST", {
          parent: { database_id: process.env.NOTION_MEAL_PLAN_DB_ID },
          properties: {
            Name: titleProp(entry.name),
            Date: dateProp(today),
            Meal: selectProp(entry.meal_slot),
            "Calories": numberProp(entry.calories),
            "Protein (g)": numberProp(entry.protein_g),
            "Carbs (g)": numberProp(entry.carbs_g),
            "Fat (g)": numberProp(entry.fat_g),
            "Fiber (g)": numberProp(entry.fiber_g),
            "Grams": numberProp(entry.grams_eaten),
            Source: selectProp(entry.source),
          },
        });
      }
    }

  } catch (err: any) {
    await sendMessage(`⚠️ Notion sync failed: ${err.message}`);
    throw err;
  }
}
