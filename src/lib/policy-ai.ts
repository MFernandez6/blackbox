import Anthropic from "@anthropic-ai/sdk";
import type { PolicyExtractionResult } from "@/lib/policy-extraction";
import { readStoredDocumentBytes } from "@/lib/storage";

const EXTRACTION_PROMPT = `You are extracting homeowners insurance policy data for a Florida public adjuster CMS.
Return ONLY valid JSON (no markdown) with this shape:
{
  "policyNumber": string|null,
  "carrierName": string|null,
  "coverageALimit": number|null,
  "coverageBLimit": number|null,
  "coverageCLimit": number|null,
  "coverageDLimit": number|null,
  "policyExclusions": string|null,
  "policyEndorsements": string|null,
  "coverageAnalysis": string|null,
  "confidence": number|null
}
Rules:
- Money fields are numbers in USD (no currency symbols).
- Coverage A = Dwelling, B = Other Structures, C = Personal Property, D = Loss of Use / ALE.
- policyExclusions: concise list of material exclusions.
- policyEndorsements: forms / endorsements schedule summary.
- coverageAnalysis: brief note on how limits apply; null if unknown.
- confidence: 0–1.`;

function parseJsonPayload(text: string): PolicyExtractionResult {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const parsed = JSON.parse(raw) as PolicyExtractionResult;
  return parsed;
}

/**
 * Extract policy coverage fields via Anthropic.
 * Requires ANTHROPIC_API_KEY. Reads files from Supabase public URLs or local /uploads.
 */
export async function extractPolicyFromDocument(opts: {
  fileUrl: string;
  mimeType: string;
  fileName: string;
}): Promise<PolicyExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env / Vercel to enable policy AI extraction."
    );
  }

  const client = new Anthropic({ apiKey });
  const bytes = await readStoredDocumentBytes(opts.fileUrl);
  const base64 = bytes.toString("base64");
  const mime = opts.mimeType || "application/pdf";

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  if (mime === "application/pdf" || opts.fileName.toLowerCase().endsWith(".pdf")) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    });
  } else if (mime.startsWith("image/")) {
    const mediaType = mime as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64,
      },
    });
  } else {
    const text = bytes.toString("utf8").slice(0, 120_000);
    content.push({
      type: "text",
      text: `Policy document text (${opts.fileName}):\n\n${text}`,
    });
  }

  content.push({ type: "text", text: EXTRACTION_PROMPT });

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_POLICY_MODEL || "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Extraction returned no text payload.");
  }

  return parseJsonPayload(textBlock.text);
}
