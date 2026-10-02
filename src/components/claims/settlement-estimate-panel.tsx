"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { runSettlementEstimateAction } from "@/lib/actions/settlement-estimate";
import {
  BENCHMARK_LEVELS,
  takeHome,
  type BenchmarkLevel,
  type SettlementEstimate,
} from "@/lib/claims/settlement-estimate";
import { formatCurrency } from "@/lib/utils";
import { AiFeatureBadge } from "@/components/claims/ai-feature-badge";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";

const TIERS = [
  { key: "low", label: "Low" },
  { key: "likely", label: "Likely" },
  { key: "high", label: "High" },
] as const;

export function SettlementEstimatePanel({
  claimId,
  county,
  feePercent,
  isCatClaim,
  initial,
  canRun,
}: {
  claimId: string;
  county: string;
  feePercent: number;
  isCatClaim: boolean;
  initial: SettlementEstimate | null;
  canRun: boolean;
}) {
  const router = useRouter();
  const [estimate, setEstimate] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setError("");
    setRunning(true);
    try {
      const result = await runSettlementEstimateAction(claimId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEstimate(result.data);
      toast.success("Settlement estimate updated");
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  const levelLabel: Record<BenchmarkLevel, string> = {
    COUNTY: `${county} County`,
    STATE: "Florida",
    NATIONAL: "National",
  };

  return (
    <section className="border border-brand-gold/15 p-4 sm:p-5 rounded-2xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Settlement Estimate</p>
            <AiFeatureBadge />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-brand-slate">
            Where the carrier is likely to land, benchmarked against published
            county, Florida, and national claim data, and what Blackline and
            the client take home.
          </p>
        </div>
        {canRun ? (
          <Button
            type="button"
            size="sm"
            variant="solid"
            disabled={running}
            onClick={() => void run()}
          >
            {running ? "Researching…" : estimate ? "Re-run Estimate" : "Run Estimate"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />
      ) : null}

      {running ? (
        <p className="mb-4 text-sm text-brand-slate">
          Claude is researching {county} County, Florida, and national claim
          data. This usually takes one to two minutes.
        </p>
      ) : null}

      {!estimate ? (
        !running ? (
          <p className="text-sm text-brand-slate">
            No estimate yet.
            {canRun
              ? " Add the RCV, ACV, or demand above first for a tighter range."
              : ""}
          </p>
        ) : null
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {TIERS.map((tier) => {
              const split = takeHome(estimate.range[tier.key], feePercent);
              const likely = tier.key === "likely";
              return (
                <div
                  key={tier.key}
                  className={
                    likely
                      ? "rounded-2xl border border-brand-gold/40 p-3"
                      : "border border-brand-gold/15 p-3 rounded-2xl"
                  }
                >
                  <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                    {tier.label} settlement
                  </p>
                  <p
                    className={
                      likely
                        ? "mt-1 font-mono text-lg text-brand-gold"
                        : "mt-1 font-mono text-sm text-brand-gold"
                    }
                  >
                    {formatCurrency(split.gross)}
                  </p>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-slate">
                        Blackline fee ({feePercent}%{isCatClaim ? " CAT" : ""})
                      </dt>
                      <dd className="font-mono">{formatCurrency(split.fee)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-slate">Client take-home</dt>
                      <dd className="font-mono">{formatCurrency(split.client)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          <div>
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Basis · {estimate.confidence.toLowerCase()} confidence
            </p>
            <p className="mt-1 text-sm leading-relaxed text-brand-white">
              {estimate.basis}
            </p>
          </div>

          <div className="space-y-4">
            {BENCHMARK_LEVELS.map((level) => {
              const rows = estimate.benchmarks.filter((b) => b.level === level);
              return (
                <div key={level}>
                  <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                    {levelLabel[level]} benchmarks
                  </p>
                  {rows.length === 0 ? (
                    <p className="mt-1 text-xs text-brand-slate">
                      No published figure found.
                    </p>
                  ) : (
                    <ul className="mt-1 divide-y divide-brand-white/10">
                      {rows.map((b, i) => (
                        <li
                          key={`${level}-${i}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="text-brand-white">{b.metric}</p>
                            <p className="text-xs text-brand-slate">
                              {b.url ? (
                                <a
                                  href={b.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-brand-white/20 underline-offset-2 hover:text-brand-white"
                                >
                                  {b.source}
                                </a>
                              ) : (
                                b.source
                              )}
                              {b.year ? ` · ${b.year}` : ""}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-brand-gold">
                            {b.figure ||
                              (b.amount !== null ? formatCurrency(b.amount) : "—")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {estimate.negotiationPoints.length > 0 ? (
            <div>
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Negotiation points
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-brand-white">
                {estimate.negotiationPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {estimate.caveats.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-brand-slate">
              {estimate.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : null}

          <p className="border-t border-brand-white/10 pt-3 text-[10px] leading-relaxed text-brand-slate">
            {estimate.generatedAt
              ? `Generated ${format(new Date(estimate.generatedAt), "yyyy-MM-dd h:mm a")}`
              : "Generated"}
            {estimate.generatedByName ? ` by ${estimate.generatedByName}` : ""}
            {estimate.model ? ` · ${estimate.model}` : ""} · {estimate.searches} web
            searches. Estimate only, not a coverage opinion. Fee math uses this
            file&apos;s current contingency rate; carrier payments made before
            Blackline was retained are fee-exempt under Florida law and are not
            netted out here.
          </p>
        </div>
      )}
    </section>
  );
}
