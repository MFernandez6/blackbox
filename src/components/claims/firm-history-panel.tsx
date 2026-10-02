import type { FirmHistory } from "@/lib/claims/firm-history";
import { takeHome } from "@/lib/claims/settlement-estimate";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

export function FirmHistoryPanel({
  history,
  feePercent,
  isCatClaim,
  marketLikely,
}: {
  history: FirmHistory;
  feePercent: number;
  isCatClaim: boolean;
  marketLikely: number | null;
}) {
  const { groups, projection, minSample } = history;
  const totalSettled = groups.find((g) => g.key === "ALL")?.count ?? 0;
  const split = projection ? takeHome(projection.amount, feePercent) : null;
  const vsMarket =
    projection && marketLikely
      ? (projection.amount - marketLikely) / marketLikely
      : null;

  return (
    <section className="border border-brand-gold/15 p-4 sm:p-5 rounded-2xl">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Blackline History</p>
          <Badge className="border-brand-white/20 text-brand-slate">Firm data</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-brand-slate">
          How Blackline&apos;s own settled files compare, kept separate from the
          market benchmark above. Recalculated from BLACKBOX on every load and
          never sent to Claude.
        </p>
      </div>

      {projection && split ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-brand-gold/40 p-3">
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Projected from history
            </p>
            <p className="mt-1 font-mono text-lg text-brand-gold">
              {formatCurrency(split.gross)}
            </p>
            <p className="mt-1 text-[10px] text-brand-slate">
              {projection.method} · {projection.groupLabel} ({projection.sample} files)
            </p>
          </div>
          <div className="border border-brand-gold/15 p-3 rounded-2xl">
            <dl className="space-y-1 text-xs">
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
          <div className="border border-brand-gold/15 p-3 rounded-2xl">
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Vs. market likely
            </p>
            <p className="mt-1 font-mono text-sm text-brand-white">
              {vsMarket === null
                ? "Run the estimate to compare"
                : `${vsMarket >= 0 ? "+" : ""}${(vsMarket * 100).toFixed(0)}% (${formatCurrency(marketLikely)})`}
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-brand-slate">
          Not enough history to project yet. Blackline has {totalSettled} settled
          file{totalSettled === 1 ? "" : "s"} on record; a projection starts once
          a comparison group reaches {minSample}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-brand-white/10 text-left">
              {["Comparison group", "Files", "Median", "Average", "Settled / demand", "Settled / RCV"].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.key}
                className={
                  g.count < minSample
                    ? "border-b border-brand-white/10 text-brand-slate last:border-0"
                    : "border-b border-brand-white/10 last:border-0"
                }
              >
                <td className="py-2">{g.label}</td>
                <td className="py-2 font-mono text-xs">{g.count}</td>
                <td className="py-2 font-mono text-xs">{formatCurrency(g.medianSettlement)}</td>
                <td className="py-2 font-mono text-xs">{formatCurrency(g.averageSettlement)}</td>
                <td className="py-2 font-mono text-xs">{pct(g.settledToDemand)}</td>
                <td className="py-2 font-mono text-xs">{pct(g.settledToRcv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
