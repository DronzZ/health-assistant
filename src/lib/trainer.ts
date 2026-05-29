import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { getModel, routeMessage } from "./model-router";
import { sendMessage } from "./telegram";

const client = new Anthropic();

// Tool definitions for Claude to call when logging data
const LOGGING_TOOLS: Anthropic.Tool[] = [
  {
    name: "log_water",
    description: "Log water intake in millilitres",
    input_schema: { type: "object" as const, properties: { ml: { type: "number", description: "Amount in ml" } }, required: ["ml"] },
  },
  {
    name: "log_weight",
    description: "Log morning body weight in kilograms",
    input_schema: { type: "object" as const, properties: { kg: { type: "number" } }, required: ["kg"] },
  },
  {
    name: "log_food",
    description: "Log a food item with macros",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        grams: { type: "number" },
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        fiber_g: { type: "number" },
        meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        source: { type: "string", enum: ["photo_label", "database", "estimated"] },
      },
      required: ["name", "calories", "source"],
    },
  },
  {
    name: "log_supplements",
    description: "Log supplements taken today",
    input_schema: { type: "object" as const, properties: { supplements: { type: "array", items: { type: "string" } } }, required: ["supplements"] },
  },
  {
    name: "log_readiness",
    description: "Log morning readiness scores",
    input_schema: {
      type: "object" as const,
      properties: {
        energy: { type: "number", description: "1-10" },
        soreness: { type: "number", description: "1-10" },
        knee_pain: { type: "number", description: "1-10" },
        mood: { type: "number", description: "1-10" },
      },
      required: ["energy"],
    },
  },
  {
    name: "log_pain",
    description: "Log a pain event with context",
    input_schema: {
      type: "object" as const,
      properties: {
        score: { type: "number" },
        location: { type: "string" },
        pain_type: { type: "string" },
        activity_context: { type: "string" },
        notes: { type: "string" },
      },
      required: ["score"],
    },
  },
];

async function buildContext(): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const [targetsRes, dailyRes, foodRes, garminRes, workoutRes, painRes] = await Promise.all([
    db.from("user_targets").select("*").single(),
    db.from("daily_logs").select("*").eq("date", today).single(),
    db.from("food_entries").select("*").eq("date", today).order("created_at"),
    db.from("garmin_data").select("*").eq("date", today).single(),
    db.from("workouts").select("exercise, sets, reps, weight_kg").eq("date", today),
    db.from("pain_log").select("*").eq("date", today).order("logged_at", { ascending: false }).limit(3),
  ]);

  const targets = targetsRes.data;
  const daily = dailyRes.data;
  const food = foodRes.data ?? [];
  const garmin = garminRes.data;
  const workouts = workoutRes.data ?? [];
  const pains = painRes.data ?? [];

  const totalCals = food.reduce((s: number, f: any) => s + (f.calories ?? 0), 0);
  const totalProtein = food.reduce((s: number, f: any) => s + (f.protein_g ?? 0), 0);
  const totalFiber = food.reduce((s: number, f: any) => s + (f.fiber_g ?? 0), 0);

  return `TODAY (${today}):
- Water: ${daily?.water_ml ?? 0}ml / target ${targets?.water_ml ?? 2500}ml
- Calories: ${Math.round(totalCals)} / target ${targets?.calorie_target ?? 2000} kcal
- Protein: ${Math.round(totalProtein)}g / target ${targets?.protein_g ?? 160}g
- Fiber: ${Math.round(totalFiber)}g / target ${targets?.fiber_g ?? 35}g
- Weight: ${daily?.weight_kg ?? "not logged"} kg
- Readiness: energy ${daily?.morning_energy ?? "?"}/10, soreness ${daily?.morning_soreness ?? "?"}/10, knee pain ${daily?.morning_knee_pain ?? "?"}/10, mood ${daily?.morning_mood ?? "?"}/10
- Supplements: ${daily?.supplements?.join(", ") || "none logged"}
${pains.length ? `- Pain log: ${pains.map((p: any) => `${p.pain_score}/10 (${p.location || "unspecified"}${p.activity_context ? " — " + p.activity_context : ""})`).join("; ")}` : ""}
${garmin ? `- Steps: ${garmin.steps ?? "?"} | Body Battery: ${garmin.body_battery_end ?? "?"} | Recovery time: ${garmin.recovery_time_hours ?? "?"}h | Sleep score: ${garmin.sleep_score ?? "?"}` : "- Garmin: not synced yet"}
${workouts.length ? `- Today's workouts: ${[...new Set(workouts.map((w: any) => w.exercise))].join(", ")}` : "- No workouts logged today"}
${food.length ? `- Food logged: ${food.map((f: any) => `${f.name} (${f.calories}kcal, ${f.protein_g}g protein)`).join("; ")}` : "- No food logged yet"}`;
}

async function getConversationHistory(): Promise<Anthropic.MessageParam[]> {
  const { data } = await db
    .from("conversation_history")
    .select("role, message")
    .order("created_at", { ascending: true })
    .limit(15);

  if (!data?.length) return [];
  return data.map((row: any) => ({
    role: row.role as "user" | "assistant",
    content: row.message,
  }));
}

async function executeToolCall(name: string, input: Record<string, any>): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Ensure daily_logs row exists for today
  await db.from("daily_logs").upsert({ date: today }, { onConflict: "date", ignoreDuplicates: true });

  if (name === "log_water") {
    await db.from("daily_logs").upsert(
      { date: today, water_ml: input.ml },
      { onConflict: "date" }
    );
    // Partial update workaround: increment existing value
    const { data } = await db.from("daily_logs").select("water_ml").eq("date", today).single();
    const current = data?.water_ml ?? 0;
    await db.from("daily_logs").update({ water_ml: current + input.ml }).eq("date", today);
  } else if (name === "log_weight") {
    await db.from("daily_logs").update({ weight_kg: input.kg }).eq("date", today);
  } else if (name === "log_food") {
    await db.from("food_entries").insert({
      date: today,
      name: input.name,
      grams_eaten: input.grams ?? null,
      calories: input.calories,
      protein_g: input.protein_g ?? 0,
      carbs_g: input.carbs_g ?? 0,
      fat_g: input.fat_g ?? 0,
      fiber_g: input.fiber_g ?? 0,
      meal_slot: input.meal_slot ?? "snack",
      source: input.source,
    });
  } else if (name === "log_supplements") {
    const { data } = await db.from("daily_logs").select("supplements").eq("date", today).single();
    const existing: string[] = data?.supplements ?? [];
    const merged = [...new Set([...existing, ...input.supplements])];
    await db.from("daily_logs").update({ supplements: merged }).eq("date", today);
  } else if (name === "log_readiness") {
    await db.from("daily_logs").update({
      morning_energy: input.energy ?? null,
      morning_soreness: input.soreness ?? null,
      morning_knee_pain: input.knee_pain ?? null,
      morning_mood: input.mood ?? null,
    }).eq("date", today);
  } else if (name === "log_pain") {
    await db.from("pain_log").insert({
      date: today,
      pain_score: input.score,
      location: input.location ?? null,
      pain_type: input.pain_type ?? null,
      activity_context: input.activity_context ?? null,
      notes: input.notes ?? null,
    });
  }
}

const SYSTEM_PROMPT = `You are a ruthless, knowledgeable personal trainer and health coach. You have full access to the user's health data shown in the context below.

USER PROFILE:
- Experienced lifter, years of bodybuilder-coached training
- Goal: lose fat while maintaining/building muscle
- Starting running alongside lifting — needs smart scheduling
- Chronic knee pain — you NEVER suggest running when knee pain ≥ 7/10
- Poor recovery history — you actively monitor Body Battery and HRV

YOUR STYLE:
- Direct and hard. No fluff, no sugarcoating.
- Acknowledge what went well briefly, then call out what was missed.
- Give one specific, actionable instruction for what to do next.
- If the user can log something, use a logging tool.
- If macros were estimated, always mention that with a ⚠️.

CRITICAL RULES:
- Knee pain ≥ 7: no running suggestion, period.
- Protein < 25g per meal on training days: call it out.
- Weight loss > 1%/week: alert muscle loss risk immediately.`;

export async function handleConversation(userMessage: string): Promise<void> {
  const [context, history] = await Promise.all([buildContext(), getConversationHistory()]);
  const tier = routeMessage(userMessage);
  const model = getModel(tier);

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: `${SYSTEM_PROMPT}\n\n${context}`,
    tools: LOGGING_TOOLS,
    messages,
  });

  // Execute any tool calls
  const toolResults: Anthropic.ToolResultBlockParam[] = [];
  for (const block of response.content) {
    if (block.type === "tool_use") {
      await executeToolCall(block.name, block.input as Record<string, any>);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "logged" });
    }
  }

  // If tools were called, get the final text response
  let replyText = "";
  if (toolResults.length > 0) {
    const followUp = await client.messages.create({
      model,
      max_tokens: 512,
      system: `${SYSTEM_PROMPT}\n\n${context}`,
      messages: [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ],
    });
    replyText = followUp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n");
  } else {
    replyText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n");
  }

  // Persist conversation
  await db.from("conversation_history").insert([
    { role: "user", message: userMessage, model_used: model },
    { role: "assistant", message: replyText, model_used: model, token_count: response.usage?.output_tokens },
  ]);

  await sendMessage(replyText);
}
