import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./model-router";

const client = new Anthropic();

export interface FoodMacros {
  name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: "database" | "estimated" | "photo_label";
  warning?: string;
}

// Try Open Food Facts first, fall back to Claude estimation
export async function lookupFood(query: string): Promise<FoodMacros[]> {
  const items = parseMultipleItems(query);
  const results: FoodMacros[] = [];

  for (const item of items) {
    const result = await lookupSingleItem(item.name, item.grams);
    results.push(result);
  }

  return results;
}

function parseMultipleItems(query: string): { name: string; grams: number }[] {
  // "200g chicken breast, 150g rice" ? [{name: "chicken breast", grams: 200}, ...]
  const parts = query.split(/,\s*/);
  return parts.map((part) => {
    const match = part.match(/^(\d+(?:\.\d+)?)\s*g?\s+(.+)$/i) ||
                  part.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*g?$/i);
    if (match) {
      const grams = parseFloat(match[1]) || parseFloat(match[2]);
      const name = (match[2] || match[1]).trim();
      return { name, grams: isNaN(grams) ? 100 : grams };
    }
    return { name: part.trim(), grams: 100 };
  });
}

async function lookupSingleItem(name: string, grams: number): Promise<FoodMacros> {
  // Try Open Food Facts
  try {
    const offResult = await searchOpenFoodFacts(name, grams);
    if (offResult) return offResult;
  } catch {
    // Fall through to Claude estimation
  }

  // Fallback: Claude estimation
  return await estimateWithClaude(name, grams);
}

async function searchOpenFoodFacts(name: string, grams: number): Promise<FoodMacros | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=3`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;

  const data = await res.json();
  const products = data.products as any[];
  if (!products?.length) return null;

  // Find the first product with complete nutritional data
  for (const product of products) {
    const n = product.nutriments;
    if (!n?.["energy-kcal_100g"] && !n?.["energy_100g"]) continue;

    const per100 = {
      kcal: n["energy-kcal_100g"] ?? (n["energy_100g"] ?? 0) / 4.184,
      protein: n["proteins_100g"] ?? 0,
      carbs: n["carbohydrates_100g"] ?? 0,
      fat: n["fat_100g"] ?? 0,
      fiber: n["fiber_100g"] ?? 0,
    };

    const multiplier = grams / 100;
    return {
      name: product.product_name || name,
      grams,
      calories: Math.round(per100.kcal * multiplier),
      protein_g: Math.round(per100.protein * multiplier * 10) / 10,
      carbs_g: Math.round(per100.carbs * multiplier * 10) / 10,
      fat_g: Math.round(per100.fat * multiplier * 10) / 10,
      fiber_g: Math.round(per100.fiber * multiplier * 10) / 10,
      source: "database",
    };
  }

  return null;
}

async function estimateWithClaude(name: string, grams: number): Promise<FoodMacros> {
  const response = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 200,
    system: "You are a nutrition database. Return only valid JSON, no markdown.",
    messages: [
      {
        role: "user",
        content: `Estimate macros per 100g for: ${name}. Return JSON: {"kcal_per_100g": number, "protein_per_100g": number, "carbs_per_100g": number, "fat_per_100g": number, "fiber_per_100g": number}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  const multiplier = grams / 100;

  return {
    name,
    grams,
    calories: Math.round((parsed.kcal_per_100g ?? 0) * multiplier),
    protein_g: Math.round((parsed.protein_per_100g ?? 0) * multiplier * 10) / 10,
    carbs_g: Math.round((parsed.carbs_per_100g ?? 0) * multiplier * 10) / 10,
    fat_g: Math.round((parsed.fat_per_100g ?? 0) * multiplier * 10) / 10,
    fiber_g: Math.round((parsed.fiber_per_100g ?? 0) * multiplier * 10) / 10,
    source: "estimated",
    warning: "?? Macros estimated � verify with a label if accuracy matters",
  };
}
