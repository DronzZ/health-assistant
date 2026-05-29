import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./model-router";
import type { FoodMacros } from "./food-lookup";

const client = new Anthropic();

// Parse a nutrition label photo into macros for a given portion size
export async function parseFoodLabel(
  imageBase64: string,
  mimeType: string,
  gramsHint: number
): Promise<FoodMacros> {
  const response = await client.messages.create({
    model: MODELS.sonnet,
    max_tokens: 300,
    system: "You are a nutrition label reader. Extract nutritional data and return only valid JSON.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Read the nutrition label. The person ate ${gramsHint}g. Return JSON: {"product_name": string, "kcal_per_100g": number, "protein_per_100g": number, "carbs_per_100g": number, "fat_per_100g": number, "fiber_per_100g": number}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  const multiplier = gramsHint / 100;

  return {
    name: parsed.product_name || "Unknown product",
    grams: gramsHint,
    calories: Math.round((parsed.kcal_per_100g ?? 0) * multiplier),
    protein_g: Math.round((parsed.protein_per_100g ?? 0) * multiplier * 10) / 10,
    carbs_g: Math.round((parsed.carbs_per_100g ?? 0) * multiplier * 10) / 10,
    fat_g: Math.round((parsed.fat_per_100g ?? 0) * multiplier * 10) / 10,
    fiber_g: Math.round((parsed.fiber_per_100g ?? 0) * multiplier * 10) / 10,
    source: "photo_label",
  };
}

// Extract grams from message text or caption
export function extractGrams(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*g/i);
  return match ? parseFloat(match[1]) : null;
}
