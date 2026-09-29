export type BenchmarkLevel = "COUNTY" | "STATE" | "NATIONAL";

export const BENCHMARK_LEVELS: BenchmarkLevel[] = ["COUNTY", "STATE", "NATIONAL"];

export type SettlementBenchmark = {
  level: BenchmarkLevel;
  metric: string;
  figure: string;
  amount: number | null;
  year: string | null;
  source: string;
  url: string | null;
};

export type EstimateConfidence = "LOW" | "MEDIUM" | "HIGH";

export type SettlementEstimate = {
  range: { low: number; likely: number; high: number };
  basis: string;
  benchmarks: SettlementBenchmark[];
  negotiationPoints: string[];
  caveats: string[];
  confidence: EstimateConfidence;
  model: string;
  searches: number;
  generatedAt: string;
  generatedByName: string;
};

export type TakeHome = { gross: number; fee: number; client: number };

/** Fee applies to the full recovery; pre-retention carrier payments are not netted out here. */
export function takeHome(gross: number, feePercent: number): TakeHome {
  const fee = Math.round(gross * feePercent) / 100;
  return { gross, fee, client: gross - fee };
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strList(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v, 800)).filter(Boolean).slice(0, maxItems);
}

function coerceBenchmark(raw: unknown): SettlementBenchmark | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const level = String(o.level ?? "").toUpperCase();
  if (!BENCHMARK_LEVELS.includes(level as BenchmarkLevel)) return null;
  const metric = str(o.metric, 300);
  const source = str(o.source, 300);
  if (!metric || !source) return null;
  const url = str(o.url, 1000);
  return {
    level: level as BenchmarkLevel,
    metric,
    figure: str(o.figure, 300),
    amount: num(o.amount),
    year: str(o.year, 20) || null,
    source,
    url: /^https?:\/\//.test(url) ? url : null,
  };
}

/** Validate model output or a stored JSON column; returns null when unusable. */
export function coerceSettlementEstimate(raw: unknown): SettlementEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const r = (o.range ?? {}) as Record<string, unknown>;
  const figures = [num(r.low), num(r.likely), num(r.high)];
  if (figures.some((f) => f === null)) return null;
  const [low, likely, high] = (figures as number[])
    .map((f) => Math.max(0, Math.round(f)))
    .sort((a, b) => a - b);
  const confidence = String(o.confidence ?? "").toUpperCase();
  return {
    range: { low, likely, high },
    basis: str(o.basis, 3000),
    benchmarks: Array.isArray(o.benchmarks)
      ? o.benchmarks
          .map(coerceBenchmark)
          .filter((b): b is SettlementBenchmark => b !== null)
          .slice(0, 15)
      : [],
    negotiationPoints: strList(o.negotiationPoints),
    caveats: strList(o.caveats),
    confidence:
      confidence === "HIGH" || confidence === "MEDIUM" ? confidence : "LOW",
    model: str(o.model, 100),
    searches: num(o.searches) ?? 0,
    generatedAt: str(o.generatedAt, 40),
    generatedByName: str(o.generatedByName, 200),
  };
}
