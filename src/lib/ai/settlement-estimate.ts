import type Anthropic from "@anthropic-ai/sdk";
import type { LossType } from "@prisma/client";
import { claudeClient, messageText, parseJsonText, resolveModel } from "@/lib/ai/claude";
import {
  coerceSettlementEstimate,
  type SettlementEstimate,
} from "@/lib/claims/settlement-estimate";

const DEFAULT_ESTIMATE_MODEL = "claude-sonnet-4-6";
const MAX_SEARCHES = 6;
const MAX_CONTINUATIONS = 3;

/** De-identified file facts only — no claimant names, street address, or claim numbers. */
export type SettlementEstimateInput = {
  lossType: LossType;
  dateOfLoss: string;
  county: string;
  zipCode: string;
  isCatClaim: boolean;
  status: string;
  carrierName: string | null;
  lossDescription: string | null;
  figures: {
    estimatedValue: number | null;
    rcvAmount: number | null;
    acvAmount: number | null;
    demandAmount: number | null;
    carrierPaymentsLogged: number;
  };
  coverage: Array<{
    line: string;
    limits: Array<{ label: string; amount: number | null }>;
    deductibleNotes: string | null;
  }>;
};

const SYSTEM = `You are a settlement benchmarking analyst for Blackline Public Adjusters, a Florida public-adjusting firm.
Your job: use web search to find PUBLISHED market statistics for residential property insurance claims at three levels — the claim's county, Florida statewide, and U.S. national — then estimate where the carrier is likely to land on this file so the adjuster can negotiate from market data.

Sources to prefer: Florida Office of Insurance Regulation (floir.com) claims and catastrophe data calls, Florida Department of Financial Services, Citizens Property Insurance, FEMA / OpenFEMA NFIP claims (water / flood), Insurance Information Institute (iii.org), NAIC, Verisk / ISO, NOAA / NCEI event data, and reputable news coverage of those reports. Blackline's own claim history is intentionally NOT used.

Search hygiene: search queries may contain the county, state, peril, year, event or storm names, and carrier name. Never put street addresses, ZIP codes, people's names, or policy / claim numbers into a search query.

After researching, reply with ONLY a JSON object (no markdown, no prose before or after):
{
  "benchmarks": [
    {
      "level": "COUNTY" | "STATE" | "NATIONAL",
      "metric": string,          // what was measured, e.g. "Average paid homeowners wind claim"
      "figure": string,          // the figure as published, e.g. "$18,400 average paid (2023)"
      "amount": number | null,   // USD value when the figure is a dollar amount
      "year": string | null,
      "source": string,          // publisher + report name
      "url": string              // page where the figure was found
    }
  ],
  "range": { "low": number, "likely": number, "high": number },
  "basis": string,
  "negotiationPoints": string[],
  "caveats": string[],
  "confidence": "LOW" | "MEDIUM" | "HIGH"
}

Rules:
- range is the expected TOTAL carrier payment on this claim in USD, net of deductible, BEFORE any public-adjuster fee. low <= likely <= high. Do not compute the PA fee — the app applies it.
- Never exceed known policy limits for the affected coverages.
- When the file has an estimate, RCV, ACV, or demand, anchor on it and use benchmarks (average paid severity, paid-to-claimed ratios, closed-with-payment rates, PA-represented vs unrepresented outcomes where published) to judge where the carrier is likely to settle. With no file figures, derive the range from peril severity benchmarks for the county and state.
- Give at least one benchmark per level. If no county-level figure is published for this peril, add a COUNTY entry with amount null that says so, and use the closest proxy (event-specific county data, metro area, or region).
- Only cite figures that appear in your search results; every benchmark needs a source and url. Never invent statistics. If data is thin, lower confidence and say why in caveats.
- basis: 2–4 sentences explaining how the range follows from the benchmarks and the file figures.
- negotiationPoints: 3–5 sentences the adjuster can use with the carrier, each tied to a specific benchmark.
- caveats: 1–4 short items (data age, proxy geography, missing file figures, coverage questions).`;

function usd(n: number | null): string {
  return n === null ? "not on file" : `$${Math.round(n).toLocaleString("en-US")}`;
}

function describeFile(input: SettlementEstimateInput): string {
  const f = input.figures;
  const coverage = input.coverage.length
    ? input.coverage
        .map((p) => {
          const limits = p.limits
            .filter((l) => l.amount !== null)
            .map((l) => `${l.label} ${usd(l.amount)}`)
            .join("; ");
          const ded = p.deductibleNotes ? ` Deductibles: ${p.deductibleNotes.slice(0, 400)}` : "";
          return `- ${p.line}: ${limits || "limits not on file"}.${ded}`;
        })
        .join("\n")
    : "- No coverage limits on file.";

  return `Claim facts (de-identified):
- Peril / loss type: ${input.lossType}
- Date of loss: ${input.dateOfLoss.slice(0, 10)}
- Location: ${input.county} County, Florida
- Declared catastrophe / emergency: ${input.isCatClaim ? "yes" : "no"}
- File status: ${input.status}
- Carrier: ${input.carrierName || "not on file"}
- Loss narrative: ${input.lossDescription?.slice(0, 1200) || "not on file"}

File figures:
- Estimated claim value: ${usd(f.estimatedValue)}
- RCV (replacement cost estimate): ${usd(f.rcvAmount)}
- ACV (actual cash value estimate): ${usd(f.acvAmount)}
- Demand submitted: ${usd(f.demandAmount)}
- Carrier payments logged so far: ${usd(f.carrierPaymentsLogged || null)}

Coverage:
${coverage}

Research county, Florida, and national benchmarks for this peril, then return the JSON.`;
}

export async function estimateSettlement(
  input: SettlementEstimateInput,
  generatedByName: string
): Promise<SettlementEstimate> {
  const client = claudeClient("the settlement estimate");
  const model = resolveModel("ANTHROPIC_ESTIMATE_MODEL", DEFAULT_ESTIMATE_MODEL);

  const tools: Anthropic.ToolUnion[] = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: MAX_SEARCHES,
      user_location: {
        type: "approximate",
        region: "Florida",
        country: "US",
        timezone: "America/New_York",
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: describeFile(input) },
  ];

  let message: Anthropic.Message | null = null;
  let searches = 0;
  try {
    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      message = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM,
        tools,
        messages,
      });
      searches += message.usage.server_tool_use?.web_search_requests ?? 0;
      if (message.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: message.content });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Settlement estimate failed (model ${model}): ${detail}`);
  }

  if (!message) throw new Error("Settlement estimate returned no response.");

  let parsed: unknown;
  try {
    parsed = parseJsonText(messageText(message));
  } catch {
    throw new Error("Claude returned an unreadable estimate. Try again.");
  }

  const estimate = coerceSettlementEstimate({
    ...(parsed as Record<string, unknown>),
    model,
    searches,
    generatedAt: new Date().toISOString(),
    generatedByName,
  });
  if (!estimate) {
    throw new Error("Claude's estimate was missing a settlement range. Try again.");
  }
  return estimate;
}
