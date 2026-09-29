import Anthropic from "@anthropic-ai/sdk";

const RETIRED_MODELS = new Set([
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-0",
  "claude-opus-4-20250514",
]);

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function claudeClient(feature: string): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      `ANTHROPIC_API_KEY is not set. Add it to .env / Vercel to enable ${feature}.`
    );
  }
  return new Anthropic({ apiKey });
}

/** Per-feature model override (e.g. ANTHROPIC_POLICY_MODEL); retired IDs fall back. */
export function resolveModel(envName: string, fallback: string): string {
  const raw = (process.env[envName] || "").trim();
  if (!raw || RETIRED_MODELS.has(raw) || raw === "[SENSITIVE]") {
    return fallback;
  }
  return raw;
}

/** Cited answers arrive as several text blocks split mid-sentence; join without separators. */
export function messageText(message: Anthropic.Message): string {
  return message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

/** Parse a JSON object from model text, tolerating code fences and leading prose. */
export function parseJsonText<T>(text: string): T {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return JSON.parse(fence[1].trim()) as T;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  }
  return JSON.parse(trimmed) as T;
}
