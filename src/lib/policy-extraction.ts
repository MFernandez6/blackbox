import type { PolicyLine } from "@prisma/client";

/** One limit row extracted / edited for any product line */
export type PolicyLimitRow = {
  key: string;
  label: string;
  amount: number | null;
  notes?: string | null;
};

/**
 * Expected shape of Document.extractedData after multi-line policy extraction.
 * Supports HO, condo master / commercial property, CGL, umbrella, flood, excess, etc.
 */
export type PolicyExtractionResult = {
  policyLine?: PolicyLine | null;
  label?: string | null;
  policyNumber?: string | null;
  carrierName?: string | null;
  namedInsured?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  premium?: number | null;
  limits?: PolicyLimitRow[] | null;
  deductibleNotes?: string | null;
  policyExclusions?: string | null;
  policyEndorsements?: string | null;
  coverageAnalysis?: string | null;
  /** Legacy HO fields — still accepted for older extractions payloads */
  coverageALimit?: number | null;
  coverageBLimit?: number | null;
  coverageCLimit?: number | null;
  coverageDLimit?: number | null;
  confidence?: number | null;
};

export function isPolicyExtractionResult(
  value: unknown
): value is PolicyExtractionResult {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_LINES = new Set<string>([
  "HOMEOWNERS",
  "CONDO_MASTER",
  "COMMERCIAL_PROPERTY",
  "CGL",
  "UMBRELLA",
  "EXCESS",
  "FLOOD",
  "AUTO",
  "WORKERS_COMP",
  "OTHER",
]);

export function coercePolicyLine(
  value: unknown,
  fallback: PolicyLine = "OTHER"
): PolicyLine {
  if (typeof value === "string" && VALID_LINES.has(value)) {
    return value as PolicyLine;
  }
  return fallback;
}

/** Default empty limit templates by product line (for manual entry UI). */
export const POLICY_LINE_LIMIT_TEMPLATES: Record<
  PolicyLine,
  Array<{ key: string; label: string }>
> = {
  HOMEOWNERS: [
    { key: "coverage_a", label: "Coverage A — Dwelling" },
    { key: "coverage_b", label: "Coverage B — Other Structures" },
    { key: "coverage_c", label: "Coverage C — Personal Property" },
    { key: "coverage_d", label: "Coverage D — Loss of Use / ALE" },
  ],
  CONDO_MASTER: [
    { key: "building", label: "Building / TIV" },
    { key: "ordinance_law", label: "Ordinance or Law" },
    { key: "business_income", label: "Business Income / Rents" },
  ],
  COMMERCIAL_PROPERTY: [
    { key: "building", label: "Building" },
    { key: "bpp", label: "Business Personal Property" },
    { key: "business_income", label: "Business Income" },
  ],
  CGL: [
    { key: "each_occurrence", label: "Each Occurrence" },
    { key: "damage_premises", label: "Damage to Premises Rented" },
    { key: "med_pay", label: "Medical Payments" },
    { key: "personal_advertising", label: "Personal & Advertising Injury" },
    { key: "general_aggregate", label: "General Aggregate" },
    { key: "products_aggregate", label: "Products / Completed Ops Aggregate" },
  ],
  UMBRELLA: [
    { key: "each_occurrence", label: "Each Occurrence" },
    { key: "aggregate", label: "Aggregate" },
  ],
  EXCESS: [
    { key: "occurrence", label: "Occurrence / Attachment" },
    { key: "limit", label: "Excess Limit" },
  ],
  FLOOD: [
    { key: "building", label: "Building" },
    { key: "contents", label: "Contents" },
    { key: "loss_of_use", label: "Loss of Use" },
  ],
  AUTO: [
    { key: "csl", label: "Combined Single Limit" },
    { key: "bi_person", label: "BI Per Person" },
    { key: "bi_accident", label: "BI Per Accident" },
    { key: "pd", label: "Property Damage" },
  ],
  WORKERS_COMP: [
    { key: "el_accident", label: "EL Each Accident" },
    { key: "el_disease_ee", label: "EL Disease — Each Employee" },
    { key: "el_disease_policy", label: "EL Disease — Policy Limit" },
  ],
  OTHER: [{ key: "limit", label: "Limit" }],
};

/** Promote legacy A–D into limits[] when AI returns older shape. */
export function normalizeExtractionLimits(
  extracted: PolicyExtractionResult
): PolicyLimitRow[] {
  if (Array.isArray(extracted.limits) && extracted.limits.length > 0) {
    return extracted.limits.map((row) => ({
      key: row.key || row.label || "limit",
      label: row.label || row.key || "Limit",
      amount:
        typeof row.amount === "number" && Number.isFinite(row.amount)
          ? row.amount
          : null,
      notes: row.notes ?? null,
    }));
  }

  const legacy: PolicyLimitRow[] = [];
  const push = (key: string, label: string, amount?: number | null) => {
    if (amount === null || amount === undefined) return;
    legacy.push({ key, label, amount, notes: null });
  };
  push("coverage_a", "Coverage A — Dwelling", extracted.coverageALimit);
  push("coverage_b", "Coverage B — Other Structures", extracted.coverageBLimit);
  push("coverage_c", "Coverage C — Personal Property", extracted.coverageCLimit);
  push("coverage_d", "Coverage D — Loss of Use / ALE", extracted.coverageDLimit);
  return legacy;
}

/** Coerce ClaimPolicy.limits JSON into editable rows. */
export function parseLimitsJson(value: unknown): PolicyLimitRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null
    )
    .map((row) => ({
      key: String(row.key ?? row.label ?? "limit"),
      label: String(row.label ?? row.key ?? "Limit"),
      amount:
        typeof row.amount === "number" && Number.isFinite(row.amount)
          ? row.amount
          : row.amount === null || row.amount === undefined
            ? null
            : Number(row.amount),
      notes:
        typeof row.notes === "string"
          ? row.notes
          : row.notes == null
            ? null
            : String(row.notes),
    }))
    .map((row) => ({
      ...row,
      amount:
        row.amount !== null && Number.isFinite(row.amount) ? row.amount : null,
    }));
}

export function limitsToLegacyHo(limits: PolicyLimitRow[]): {
  coverageALimit: number | null;
  coverageBLimit: number | null;
  coverageCLimit: number | null;
  coverageDLimit: number | null;
} {
  const find = (...keys: string[]) => {
    const row = limits.find((l) =>
      keys.some((k) => l.key.toLowerCase() === k || l.label.toLowerCase().includes(k))
    );
    return row?.amount ?? null;
  };
  return {
    coverageALimit: find("coverage_a", "dwelling"),
    coverageBLimit: find("coverage_b", "other structures"),
    coverageCLimit: find("coverage_c", "personal property"),
    coverageDLimit: find("coverage_d", "loss of use", "ale"),
  };
}
