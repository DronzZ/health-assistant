import Anthropic from "@anthropic-ai/sdk";
import { db, runQuery } from "./db";
import { getModel, routeMessage } from "./model-router";
import { sendMessage } from "./telegram";
import { todayString } from "./date";

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
  {
    name: "remember",
    description:
      "Permanently save a durable fact about the user so you NEVER ask for it again: profile details, injuries, equipment, available training days/times, goals, preferences, or a generated training/nutrition plan. Reuse the same `key` to UPDATE an existing fact instead of duplicating it. Call this whenever the user tells you something stable about themselves or their situation.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Stable identifier, snake_case, e.g. 'training_days', 'knee_injury', 'home_equipment', 'current_training_plan'" },
        value: { type: "string", description: "The fact to remember, written concisely" },
        category: { type: "string", enum: ["profile", "injury", "preference", "schedule", "goal", "plan", "other"] },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "forget",
    description: "Delete a durable fact that is no longer true. Use the exact key of the fact to remove.",
    input_schema: {
      type: "object" as const,
      properties: { key: { type: "string" } },
      required: ["key"],
    },
  },
  {
    name: "set_meal_plan_item",
    description:
      "Add or update an item in the user's weekly meal plan (shown on the dashboard). Reuse the same day_of_week + meal_slot + food_item to update an existing item. Build the full plan day by day when the user asks you to design their nutrition.",
    input_schema: {
      type: "object" as const,
      properties: {
        day_of_week: { type: "number", description: "0=Monday .. 6=Sunday" },
        meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        food_item: { type: "string" },
        target_grams: { type: "number" },
        kcal_per_100g: { type: "number" },
        protein_per_100g: { type: "number" },
        carbs_per_100g: { type: "number" },
        fat_per_100g: { type: "number" },
        fiber_per_100g: { type: "number" },
        is_refeed_day: { type: "boolean" },
      },
      required: ["day_of_week", "meal_slot", "food_item"],
    },
  },
  {
    name: "remove_meal_plan_item",
    description: "Remove an item from the weekly meal plan by day_of_week (0=Mon..6=Sun), meal_slot and food_item.",
    input_schema: {
      type: "object" as const,
      properties: {
        day_of_week: { type: "number" },
        meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        food_item: { type: "string" },
      },
      required: ["day_of_week", "meal_slot", "food_item"],
    },
  },
];

async function buildContext(): Promise<string> {
  const today = todayString();

  const [targetsRes, dailyRes, foodRes, garminRes, workoutRes, painRes, memoryRes, mealPlanRes] = await Promise.all([
    db.from("user_targets").select("*").maybeSingle(),
    db.from("daily_logs").select("*").eq("date", today).maybeSingle(),
    db.from("food_entries").select("*").eq("date", today).order("created_at"),
    db.from("garmin_data").select("*").eq("date", today).maybeSingle(),
    db.from("workouts").select("exercise").eq("date", today),
    db.from("pain_log").select("*").eq("date", today).order("logged_at", { ascending: false }).limit(3),
    db.from("coach_memory").select("key, value, category").order("category"),
    db.from("meal_plan").select("day_of_week, meal_slot, food_item, target_grams").order("day_of_week").order("meal_slot"),
  ]);

  const targets = targetsRes.data;
  const daily = dailyRes.data;
  const food = foodRes.data ?? [];
  const garmin = garminRes.data;
  const workouts = workoutRes.data ?? [];
  const pains = painRes.data ?? [];
  const memory = memoryRes.data ?? [];
  const mealPlan = mealPlanRes.data ?? [];

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const mealByDay: Record<number, string[]> = {};
  for (const m of mealPlan as any[]) {
    (mealByDay[m.day_of_week] ??= []).push(`${m.food_item}${m.target_grams ? ` ${m.target_grams}g` : ""}`);
  }
  const mealPlanSection = mealPlan.length
    ? `\n\nWEEKLY MEAL PLAN (edit with set_meal_plan_item / remove_meal_plan_item; day_of_week 0=Mon..6=Sun):\n${DAY_NAMES
        .map((d, i) => (mealByDay[i]?.length ? `- ${d}: ${mealByDay[i].join(", ")}` : null))
        .filter(Boolean)
        .join("\n")}`
    : "\n\nWEEKLY MEAL PLAN: none set yet — use set_meal_plan_item to build one when the user asks for a nutrition plan.";

  const memorySection = memory.length
    ? `\n\nWHAT YOU ALREADY KNOW ABOUT THE USER (durable memory — NEVER ask for any of this again):\n${memory
        .map((m: any) => `- [${m.category}] ${m.key}: ${m.value}`)
        .join("\n")}`
    : "\n\nWHAT YOU ALREADY KNOW ABOUT THE USER: nothing saved yet — use the `remember` tool as you learn stable facts.";

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
${pains.length ? `- Pain log: ${pains.map((p: any) => `${p.pain_score}/10 (${p.location || "unspecified"}${p.activity_context ? " � " + p.activity_context : ""})`).join("; ")}` : ""}
${garmin ? `- Steps: ${garmin.steps ?? "?"} | Body Battery: ${garmin.body_battery_end ?? "?"} | Recovery time: ${garmin.recovery_time_hours ?? "?"}h | Sleep score: ${garmin.sleep_score ?? "?"}` : "- Garmin: not synced yet"}
${workouts.length ? `- Today's workouts: ${[...new Set(workouts.map((w: any) => w.exercise))].join(", ")}` : "- No workouts logged today"}
${food.length ? `- Food logged: ${food.map((f: any) => `${f.name} (${f.calories}kcal, ${f.protein_g}g protein)`).join("; ")}` : "- No food logged yet"}${memorySection}${mealPlanSection}`;
}

async function getConversationHistory(): Promise<Anthropic.MessageParam[]> {
  // Fetch the MOST RECENT 30 messages, then restore chronological order.
  // (Ordering ascending + limit returns the OLDEST rows, which froze the bot
  //  on the start of the conversation and made it re-ask everything.)
  const { data } = await db
    .from("conversation_history")
    .select("role, message")
    .order("created_at", { ascending: false })
    .limit(30);

  if (!data?.length) return [];
  return data
    .reverse()
    .map((row: any) => ({
      role: row.role as "user" | "assistant",
      content: row.message,
    }));
}

async function executeToolCall(name: string, input: Record<string, any>): Promise<void> {
  const today = todayString();

  // Ensure a daily_logs row exists for today before updating it.
  await runQuery(
    db.from("daily_logs").upsert({ date: today }, { onConflict: "date", ignoreDuplicates: true }),
    "ensure daily log"
  );

  if (name === "log_water") {
    // Additive: read the running total and add to it (never overwrite).
    const { data } = await db.from("daily_logs").select("water_ml").eq("date", today).maybeSingle();
    const current = data?.water_ml ?? 0;
    await runQuery(
      db.from("daily_logs").update({ water_ml: current + input.ml }).eq("date", today),
      "log water"
    );
  } else if (name === "log_weight") {
    await runQuery(
      db.from("daily_logs").update({ weight_kg: input.kg }).eq("date", today),
      "log weight"
    );
  } else if (name === "log_food") {
    await runQuery(
      db.from("food_entries").insert({
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
      }),
      "log food"
    );
  } else if (name === "log_supplements") {
    const { data } = await db.from("daily_logs").select("supplements").eq("date", today).maybeSingle();
    const existing: string[] = data?.supplements ?? [];
    const merged = [...new Set([...existing, ...input.supplements])];
    await runQuery(
      db.from("daily_logs").update({ supplements: merged }).eq("date", today),
      "log supplements"
    );
  } else if (name === "log_readiness") {
    await runQuery(
      db.from("daily_logs").update({
        morning_energy: input.energy ?? null,
        morning_soreness: input.soreness ?? null,
        morning_knee_pain: input.knee_pain ?? null,
        morning_mood: input.mood ?? null,
      }).eq("date", today),
      "log readiness"
    );
  } else if (name === "log_pain") {
    await runQuery(
      db.from("pain_log").insert({
        date: today,
        pain_score: input.score,
        location: input.location ?? null,
        pain_type: input.pain_type ?? null,
        activity_context: input.activity_context ?? null,
        notes: input.notes ?? null,
      }),
      "log pain"
    );
  } else if (name === "remember") {
    await runQuery(
      db.from("coach_memory").upsert(
        {
          key: input.key,
          value: input.value,
          category: input.category ?? "other",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      ),
      "remember"
    );
  } else if (name === "forget") {
    await runQuery(db.from("coach_memory").delete().eq("key", input.key), "forget");
  } else if (name === "set_meal_plan_item") {
    await runQuery(
      db.from("meal_plan").upsert(
        {
          day_of_week: input.day_of_week,
          meal_slot: input.meal_slot,
          food_item: input.food_item,
          target_grams: input.target_grams ?? null,
          kcal_per_100g: input.kcal_per_100g ?? null,
          protein_per_100g: input.protein_per_100g ?? null,
          carbs_per_100g: input.carbs_per_100g ?? null,
          fat_per_100g: input.fat_per_100g ?? null,
          fiber_per_100g: input.fiber_per_100g ?? null,
          is_refeed_day: input.is_refeed_day ?? false,
        },
        { onConflict: "day_of_week,meal_slot,food_item" }
      ),
      "set meal plan item"
    );
  } else if (name === "remove_meal_plan_item") {
    await runQuery(
      db
        .from("meal_plan")
        .delete()
        .eq("day_of_week", input.day_of_week)
        .eq("meal_slot", input.meal_slot)
        .eq("food_item", input.food_item),
      "remove meal plan item"
    );
  }
}

const SYSTEM_PROMPT = `You are a ruthless, knowledgeable personal trainer and health coach. You have full access to the user's health data shown in the context below.

USER PROFILE:
- Experienced lifter, years of bodybuilder-coached training
- Goal: lose fat while maintaining/building muscle
- Starting running alongside lifting � needs smart scheduling
- Chronic knee pain � you NEVER suggest running when knee pain = 7/10
- Poor recovery history � you actively monitor Body Battery and HRV

YOUR STYLE:
- Direct and hard. No fluff, no sugarcoating.
- Acknowledge what went well briefly, then call out what was missed.
- Give one specific, actionable instruction for what to do next.
- If the user can log something, use a logging tool.
- If macros were estimated, always mention that with a ??.

MEMORY (critical):
- The "WHAT YOU ALREADY KNOW ABOUT THE USER" block in the context is your durable memory. Treat it as ground truth and NEVER ask for anything already listed there.
- Whenever the user tells you a stable fact (injuries, equipment, available training days/times, goals, preferences) OR you finalise a training/nutrition plan, immediately call the \`remember\` tool to save it. Reuse the same key to update; use \`forget\` when something is no longer true.
- Before asking a question, check your memory. If you have enough saved facts to build a schedule, build it now instead of asking again.

CRITICAL RULES:
- Knee pain = 7: no running suggestion, period.
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
    max_tokens: 2048,
    system: [
      { type: "text", text: SYSTEM_PROMPT },
      { type: "text", text: context, cache_control: { type: "ephemeral" } },
    ],
    tools: LOGGING_TOOLS,
    messages,
  });

  const textOf = (content: Anthropic.ContentBlock[]): string =>
    content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n")
      .trim();

  // Execute any tool calls. A DB write that fails must NOT look like success:
  // capture the failure in the tool_result so the follow-up reply tells the user
  // honestly that nothing was saved, instead of a false "✅".
  const toolResults: Anthropic.ToolResultBlockParam[] = [];
  let anyToolFailed = false;
  for (const block of response.content) {
    if (block.type === "tool_use") {
      try {
        await executeToolCall(block.name, block.input as Record<string, any>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "logged" });
      } catch (err) {
        anyToolFailed = true;
        console.error(`Tool ${block.name} failed:`, err);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `FAILED to save: ${err instanceof Error ? err.message : "database error"}. Tell the user it was NOT saved.`,
          is_error: true,
        });
      }
    }
  }

  // If tools were called, get the final text response
  const firstText = textOf(response.content);
  let replyText = firstText;
  if (toolResults.length > 0) {
    const followUp = await client.messages.create({
      model,
      max_tokens: 2048,
      system: [
      { type: "text", text: SYSTEM_PROMPT },
      { type: "text", text: context, cache_control: { type: "ephemeral" } },
    ],
      messages: [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ],
    });
    // Prefer the follow-up text, but fall back to any text from the first
    // response so a tool-only turn never produces an empty reply.
    replyText = textOf(followUp.content) || firstText;
  }

  // Final safety net: Telegram rejects empty messages. If the model produced
  // no text at all (e.g. a pure tool-call turn), send a sensible default.
  if (!replyText) {
    if (anyToolFailed) {
      replyText = "⚠️ Er ging iets mis bij het opslaan — het is NIET bewaard. Probeer het opnieuw.";
    } else {
      replyText = toolResults.length > 0 ? "✅ Genoteerd." : "🤔 Geen antwoord gegenereerd — probeer het opnieuw.";
    }
  }

  // Persist conversation (best-effort: a failure here must not block the reply).
  try {
    await runQuery(
      db.from("conversation_history").insert([
        { role: "user", message: userMessage, model_used: model },
        { role: "assistant", message: replyText, model_used: model, token_count: response.usage?.output_tokens },
      ]),
      "save conversation"
    );
  } catch (e) {
    console.error("Failed to persist conversation:", e);
  }

  await sendMessage(replyText);
}
