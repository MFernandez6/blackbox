import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export type ContingencyFeeBasis = "settlement" | "demand" | "estimate";

/** Contingency dollars from settlement, then demand, then estimated value. */
export function projectedContingencyFee(opts: {
  percent: string | number | null | undefined;
  settlementAmount?: string | number | null;
  demandAmount?: string | number | null;
  estimatedValue?: string | number | null;
}): {
  percent: number | null;
  dollars: number | null;
  basis: ContingencyFeeBasis | null;
} {
  const percent = parseMoney(opts.percent);
  const settlement = parseMoney(opts.settlementAmount);
  const demand = parseMoney(opts.demandAmount);
  const estimate = parseMoney(opts.estimatedValue);
  const basis: ContingencyFeeBasis | null =
    settlement !== null
      ? "settlement"
      : demand !== null
        ? "demand"
        : estimate !== null
          ? "estimate"
          : null;
  const base =
    settlement ?? demand ?? estimate;
  return {
    percent,
    dollars:
      percent !== null && base !== null ? (base * percent) / 100 : null,
    basis,
  };
}

export function formatFeePercent(value: string | number | null | undefined): string {
  const n = parseMoney(value);
  if (n === null) return "—";
  return `${n}%`;
}

export function daysOpen(createdAt: Date | string): number {
  const start = new Date(createdAt);
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function contingencyForCat(isCatClaim: boolean): number {
  return isCatClaim ? 10 : 20;
}
