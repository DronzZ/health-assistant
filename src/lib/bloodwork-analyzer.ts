import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./model-router";
import { db } from "./db";
import { sendMessage } from "./telegram";

const client = new Anthropic();

interface BloodMarker {
  marker: string;
  value: number;
  unit: string;
  reference_range: string;
  status: "optimal" | "suboptimal" | "deficient" | "high" | "normal";
  recommendation?: string;
}

interface BloodworkResult {
  date: string;
  markers: BloodMarker[];
  summary: string;
  supplement_recommendations: string;
}

export async function analyzeBloodwork(imageBase64: string, mimeType: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: MODELS.opus,
    max_tokens: 2000,
    system: `You are a knowledgeable health advisor reviewing blood test results for a serious athlete focused on fat loss and muscle building.
Be thorough, direct, and specific. Focus on markers relevant to: energy, testosterone, recovery, muscle building, fat metabolism, inflammation, and general health.
For each marker, provide the value, normal range, status (optimal/suboptimal/deficient/high/normal), and specific supplement/lifestyle recommendations if suboptimal.
Pay special attention to: Vitamin D (D3), B12, Iron/Ferritin, Testosterone (free and total), TSH/T3/T4, CRP/inflammation markers, glucose/HbA1c, lipids, Magnesium, Zinc.
Return valid JSON only.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: imageBase64 },
          },
          {
            type: "text",
            text: `Analyse these blood test results. Return JSON: {
  "markers": [{"marker": string, "value": number, "unit": string, "reference_range": string, "status": "optimal"|"suboptimal"|"deficient"|"high"|"normal", "recommendation": string}],
  "summary": "2-3 sentence overall assessment",
  "supplement_recommendations": "specific supplements with doses based on deficiencies found"
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  let parsed: Partial<BloodworkResult>;
  try {
    parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    await sendMessage("⚠️ Couldn't parse the bloodwork image. Try a clearer photo or screenshot.");
    return;
  }

  // Save markers to DB
  const markers = parsed.markers ?? [];
  for (const marker of markers) {
    await db.from("bloodwork").insert({
      date: today,
      marker: marker.marker,
      value: marker.value,
      unit: marker.unit,
      reference_range: marker.reference_range,
      status: marker.status,
    });
  }

  // Format response message
  const deficient = markers.filter((m) => m.status === "deficient");
  const suboptimal = markers.filter((m) => m.status === "suboptimal");
  const high = markers.filter((m) => m.status === "high");

  let message = `🩸 *Bloodwork Analysis — ${today}*\n\n`;
  message += `${parsed.summary}\n\n`;

  if (deficient.length) {
    message += `🔴 *Deficient:*\n${deficient.map((m) => `• ${m.marker}: ${m.value} ${m.unit} — ${m.recommendation || "supplement needed"}`).join("\n")}\n\n`;
  }
  if (suboptimal.length) {
    message += `🟡 *Suboptimal:*\n${suboptimal.map((m) => `• ${m.marker}: ${m.value} ${m.unit} — ${m.recommendation || "monitor"}`).join("\n")}\n\n`;
  }
  if (high.length) {
    message += `⚠️ *High:*\n${high.map((m) => `• ${m.marker}: ${m.value} ${m.unit} — ${m.recommendation || "investigate"}`).join("\n")}\n\n`;
  }

  if (parsed.supplement_recommendations) {
    message += `💊 *Supplement Plan:*\n${parsed.supplement_recommendations}`;
  }

  message += `\n\n_Always confirm with your doctor before acting on these recommendations._`;

  await sendMessage(message);
}
