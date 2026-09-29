import type { LossType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LOSS_TYPE_LABELS } from "@/lib/claims/labels";

/** Below this many settled files a group is shown but not used for a projection. */
export const FIRM_HISTORY_MIN_SAMPLE = 3;

export type FirmHistoryGroup = {
  key: "PERIL_COUNTY" | "PERIL" | "ALL";
  label: string;
  count: number;
  medianSettlement: number | null;
  averageSettlement: number | null;
  /** Median settlement ÷ demand across files that had both. */
  settledToDemand: number | null;
  /** Median settlement ÷ RCV across files that had both. */
  settledToRcv: number | null;
};

export type FirmHistory = {
  minSample: number;
  groups: FirmHistoryGroup[];
  projection: {
    amount: number;
    method: string;
    groupLabel: string;
    sample: number;
  } | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

type SettledRow = {
  settlement: number;
  demand: number | null;
  rcv: number | null;
};

function summarize(
  key: FirmHistoryGroup["key"],
  label: string,
  rows: SettledRow[]
): FirmHistoryGroup {
  const settlements = rows.map((r) => r.settlement);
  const ratio = (pick: (r: SettledRow) => number | null) =>
    median(
      rows
        .map((r) => {
          const base = pick(r);
          return base && base > 0 ? r.settlement / base : null;
        })
        .filter((v): v is number => v !== null)
    );
  return {
    key,
    label,
    count: rows.length,
    medianSettlement: median(settlements),
    averageSettlement: settlements.length
      ? settlements.reduce((a, b) => a + b, 0) / settlements.length
      : null,
    settledToDemand: ratio((r) => r.demand),
    settledToRcv: ratio((r) => r.rcv),
  };
}

/**
 * Blackline's own settled files, kept separate from the Claude market benchmark.
 * Projection prefers the narrowest group with enough files, and a ratio on this
 * claim's demand / RCV over a raw median.
 */
export async function loadFirmHistory(claim: {
  id: string;
  lossType: LossType;
  county: string;
  demandAmount: Prisma.Decimal | null;
  rcvAmount: Prisma.Decimal | null;
}): Promise<FirmHistory> {
  const settled = await prisma.claim.findMany({
    where: { id: { not: claim.id }, settlementAmount: { gt: 0 } },
    select: {
      lossType: true,
      county: true,
      settlementAmount: true,
      demandAmount: true,
      rcvAmount: true,
    },
  });

  const rows = settled.map((c) => ({
    lossType: c.lossType,
    county: c.county.trim().toLowerCase(),
    settlement: Number(c.settlementAmount),
    demand: toNumber(c.demandAmount),
    rcv: toNumber(c.rcvAmount),
  }));
  const county = claim.county.trim().toLowerCase();
  const peril = rows.filter((r) => r.lossType === claim.lossType);

  const perilLabel = LOSS_TYPE_LABELS[claim.lossType];
  const groups = [
    summarize(
      "PERIL_COUNTY",
      `${perilLabel} claims in ${claim.county} County`,
      peril.filter((r) => r.county === county)
    ),
    summarize("PERIL", `${perilLabel} claims, all counties`, peril),
    summarize("ALL", "All Blackline settlements", rows),
  ];

  const demand = toNumber(claim.demandAmount);
  const rcv = toNumber(claim.rcvAmount);
  let projection: FirmHistory["projection"] = null;
  for (const g of groups) {
    if (g.count < FIRM_HISTORY_MIN_SAMPLE) continue;
    if (demand && g.settledToDemand !== null) {
      projection = {
        amount: Math.round(demand * g.settledToDemand),
        method: `Demand × ${(g.settledToDemand * 100).toFixed(0)}% median settled-to-demand`,
        groupLabel: g.label,
        sample: g.count,
      };
    } else if (rcv && g.settledToRcv !== null) {
      projection = {
        amount: Math.round(rcv * g.settledToRcv),
        method: `RCV × ${(g.settledToRcv * 100).toFixed(0)}% median settled-to-RCV`,
        groupLabel: g.label,
        sample: g.count,
      };
    } else if (g.medianSettlement !== null) {
      projection = {
        amount: Math.round(g.medianSettlement),
        method: "Median settlement",
        groupLabel: g.label,
        sample: g.count,
      };
    }
    if (projection) break;
  }

  return { minSample: FIRM_HISTORY_MIN_SAMPLE, groups, projection };
}
