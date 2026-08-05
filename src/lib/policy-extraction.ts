/**
 * Expected shape of Document.extractedData after policy (certified copy) extraction.
 * AI_HOOK: extraction service should return this JSON into Document.extractedData.
 */
export type PolicyExtractionResult = {
  policyNumber?: string | null;
  carrierName?: string | null;
  /** Coverage A — Dwelling */
  coverageALimit?: number | null;
  /** Coverage B — Other Structures */
  coverageBLimit?: number | null;
  /** Coverage C — Personal Property */
  coverageCLimit?: number | null;
  /** Coverage D — Loss of Use / ALE */
  coverageDLimit?: number | null;
  /** Listed exclusions from the certified policy */
  policyExclusions?: string | null;
  /** Endorsements / forms schedule */
  policyEndorsements?: string | null;
  /** Draft coverage analysis for this loss (optional at extract time) */
  coverageAnalysis?: string | null;
  /** Confidence 0–1 from extractor */
  confidence?: number | null;
};

export function isPolicyExtractionResult(
  value: unknown
): value is PolicyExtractionResult {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
