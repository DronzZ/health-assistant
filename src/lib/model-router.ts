// Routes messages to the appropriate Claude model based on complexity.
// Haiku for simple logging, Sonnet for coaching/analysis, Opus for high-stakes tasks.

export type ModelTier = "haiku" | "sonnet" | "opus";

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
} as const;

const SIMPLE_PATTERNS = [
  /^\/(water|weight|supplements?|readiness|pain|today|measure|food|alcohol)/i,
  /^(drank|had|ate|weighed|took|logged|drank)/i,
  /\d+\s*(ml|l|litre|liter|kg|g|gram)/i,
];

const OPUS_PATTERNS = [
  /blood\s*work|blood\s*test|lab\s*results?/i,
  /weekly\s*sleep|sleep\s*insight/i,
];

export function routeMessage(text: string): ModelTier {
  if (OPUS_PATTERNS.some((p) => p.test(text))) return "opus";
  if (SIMPLE_PATTERNS.some((p) => p.test(text))) return "haiku";
  return "sonnet";
}

export function getModel(tier: ModelTier): string {
  return MODELS[tier];
}
