import Anthropic from "@anthropic-ai/sdk";
import type { PolicyLine } from "@prisma/client";
import {
  type PolicyExtractionResult,
  normalizeExtractionLimits,
  coercePolicyLine,
} from "@/lib/policy-extraction";
import { readStoredDocumentBytes } from "@/lib/storage";

const POLICY_LINES =
  "HOMEOWNERS | CONDO_MASTER | COMMERCIAL_PROPERTY | CGL | UMBRELLA | EXCESS | FLOOD | AUTO | WORKERS_COMP | OTHER";

const EXTRACTION_PROMPT = `You are extracting insurance policy data for a Florida public adjuster CMS (BLACKBOX).
The document may be a homeowners policy, condo master / commercial property, CGL, umbrella, excess, flood declarations, COI with policy schedule, auto, or other.

Return ONLY valid JSON (no markdown) with this shape:
{
  "policyLine": one of [${POLICY_LINES}],
  "label": string|null,
  "policyNumber": string|null,
  "carrierName": string|null,
  "namedInsured": string|null,
  "effectiveDate": "YYYY-MM-DD"|null,
  "expirationDate": "YYYY-MM-DD"|null,
  "premium": number|null,
  "limits": [{ "key": string, "label": string, "amount": number|null, "notes": string|null }],
  "deductibleNotes": string|null,
  "policyExclusions": string|null,
  "policyEndorsements": string|null,
  "coverageAnalysis": string|null,
  "confidence": number|null
}

Classification guidance:
- HO-3 / dwelling / personal homeowners → HOMEOWNERS
- Condo association master property / building TIV → CONDO_MASTER
- Commercial property (non-condo) → COMMERCIAL_PROPERTY
- Commercial General Liability declarations / CG 00 01 → CGL
- Umbrella / excess liability → UMBRELLA or EXCESS
- Flood (NFIP / private flood / Wright National Flood, etc.) → FLOOD
- Auto liability → AUTO
- Workers compensation → WORKERS_COMP
- Certificate of Insurance: classify by the primary policy schedule described; prefer the most material property/liability layer for the named insured. If multiple layers are listed, extract the flood or master property details if this is clearly a flood/master package; otherwise use OTHER and put layered schedule notes in coverageAnalysis.

Limit key conventions (use these keys when applicable):
- HOMEOWNERS: coverage_a, coverage_b, coverage_c, coverage_d
- CGL: each_occurrence, damage_premises, med_pay, personal_advertising, general_aggregate, products_aggregate
- UMBRELLA/EXCESS: each_occurrence, aggregate (and attachment/limit for EXCESS)
- FLOOD: building, contents, loss_of_use
- CONDO_MASTER / COMMERCIAL_PROPERTY: building, bpp, business_income, ordinance_law as applicable

Rules:
- Money fields are numbers in USD (no currency symbols or commas).
- deductibleNotes: summarize AOP, wind/hail, named storm, water, flood deductibles as text.
- policyExclusions: concise material exclusions.
- policyEndorsements: forms / endorsements schedule summary (form numbers OK).
- coverageAnalysis: brief note on what this policy covers for a property loss file.
- confidence: 0–1.
- If the document is only an ACORD certificate, still extract policy numbers, carriers, terms, and any stated limits/TIV from the remarks.`;

function parseJsonPayload(text: string): PolicyExtractionResult {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const parsed = JSON.parse(raw) as PolicyExtractionResult;
  parsed.limits = normalizeExtractionLimits(parsed);
  return parsed;
}

/**
 * Extract policy coverage fields via Anthropic for any product line.
 */
export async function extractPolicyFromDocument(opts: {
  fileUrl: string;
  mimeType: string;
  fileName: string;
  hintLine?: PolicyLine | null;
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

  const hint = opts.hintLine
    ? `\nUser classified this upload as ${opts.hintLine}; prefer that policyLine unless the document clearly contradicts it.`
    : "";

  content.push({ type: "text", text: EXTRACTION_PROMPT + hint });

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_POLICY_MODEL || "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Extraction returned no text payload.");
  }

  const extracted = parseJsonPayload(textBlock.text);
  extracted.policyLine = coercePolicyLine(
    extracted.policyLine,
    opts.hintLine ?? "OTHER"
  );
  return extracted;
}
