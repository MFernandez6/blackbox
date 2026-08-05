"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { ClaimStatus, LossType } from "@prisma/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/claims/status-badge";
import {
  LOSS_TYPE_LABELS,
  STATUS_LABELS,
  OPEN_STATUSES,
} from "@/lib/claims/labels";
import { cn, daysOpen, formatCurrency } from "@/lib/utils";

export type DashboardClaimRow = {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  lossType: LossType;
  dateOfLoss: string;
  estimatedValue: string | null;
  updatedAt: string;
  createdAt: string;
  primaryClaimant: string;
  adjusterName: string | null;
};

export type DashboardSummary = {
  openCount: number;
  byStatus: Partial<Record<ClaimStatus, number>>;
  pipelineValue: number;
};

type AdjusterOption = { id: string; name: string };

type Props = {
  claims: DashboardClaimRow[];
  summary: DashboardSummary;
  adjusters: AdjusterOption[];
  canCreate: boolean;
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ClaimStatus[];
const ALL_LOSS = Object.keys(LOSS_TYPE_LABELS) as LossType[];

export function DashboardClient({
  claims,
  summary,
  adjusters,
  canCreate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const toggleStatus = (status: ClaimStatus) => {
    const current = searchParams.get("status")?.split(",").filter(Boolean) ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setParam("status", next.length ? next.join(",") : null);
  };

  const sort = searchParams.get("sort") ?? "updatedAt";
  const dir = searchParams.get("dir") ?? "desc";
  const selectedStatuses =
    searchParams.get("status")?.split(",").filter(Boolean) ?? [];

  function sortLink(col: string) {
    const nextDir = sort === col && dir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", col);
    params.set("dir", nextDir);
    return `${pathname}?${params.toString()}`;
  }

  function SortHeader({
    col,
    label,
    className,
  }: {
    col: string;
    label: string;
    className?: string;
  }) {
    const active = sort === col;
    return (
      <th className={cn("px-3 py-3 text-left", className)}>
        <Link
          href={sortLink(col)}
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.14em] hover:text-paper",
            active ? "text-paper" : "text-muted-foreground"
          )}
        >
          {label}
          {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
        </Link>
      </th>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Claim Status</p>
          <h1 className="mt-1 font-serif text-2xl text-paper">Active Files</h1>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/claims/new">+ New Claim</Link>
          </Button>
        ) : null}
      </div>

      {/* Summary strip */}
      <div className="grid gap-0 border border-hairline md:grid-cols-3">
        <div className="border-b border-hairline px-5 py-4 md:border-b-0 md:border-r">
          <p className="eyebrow">Open Pipeline</p>
          <p className="mt-2 font-mono text-2xl text-paper">{summary.openCount}</p>
        </div>
        <div className="border-b border-hairline px-5 py-4 md:border-b-0 md:border-r">
          <p className="eyebrow">By Status</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {OPEN_STATUSES.map((s) => (
              <span key={s} className="font-mono text-[10px] text-muted-foreground">
                {STATUS_LABELS[s]}{" "}
                <span className="text-paper">{summary.byStatus[s] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="eyebrow">Estimated Value</p>
          <p className="mt-2 font-mono text-2xl text-paper">
            {formatCurrency(summary.pipelineValue)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 border border-hairline p-4">
        <p className="eyebrow">File Integrity — Filters</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              placeholder="Claim number or claimant"
              defaultValue={searchParams.get("q") ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setParam("q", (e.target as HTMLInputElement).value || null);
                }
              }}
              onBlur={(e) => setParam("q", e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Assigned Adjuster</Label>
            <Select
              value={searchParams.get("adjuster") ?? "all"}
              onValueChange={(v) => setParam("adjuster", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All adjusters</SelectItem>
                {adjusters.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Loss Type</Label>
            <Select
              value={searchParams.get("lossType") ?? "all"}
              onValueChange={(v) => setParam("lossType", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ALL_LOSS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LOSS_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>DOL From</Label>
              <Input
                type="date"
                defaultValue={searchParams.get("from") ?? ""}
                onChange={(e) => setParam("from", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>DOL To</Label>
              <Input
                type="date"
                defaultValue={searchParams.get("to") ?? ""}
                onChange={(e) => setParam("to", e.target.value || null)}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {ALL_STATUSES.map((s) => {
            const active = selectedStatuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                  active
                    ? "border-paper bg-paper text-ink"
                    : "border-hairline text-muted-foreground hover:border-paper/40"
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div
        className={cn(
          "border border-hairline overflow-x-auto",
          pending && "opacity-60"
        )}
      >
        {claims.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="eyebrow mb-3">Secure Record</p>
            <p className="text-sm text-muted-foreground">
              No active files. Begin intake to open the first record.
            </p>
            {canCreate ? (
              <Button asChild className="mt-6" variant="outline">
                <Link href="/claims/new">Open Intake</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-hairline bg-[#0C0C0C]">
              <tr>
                <SortHeader col="claimNumber" label="Claim #" />
                <SortHeader col="claimant" label="Claimant" />
                <SortHeader col="status" label="Status" />
                <SortHeader col="lossType" label="Loss" />
                <SortHeader col="dateOfLoss" label="Date of Loss" />
                <SortHeader col="adjuster" label="Adjuster" />
                <SortHeader col="daysOpen" label="Days Open" />
                <SortHeader
                  col="estimatedValue"
                  label="Est. Value"
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-hairline last:border-0 hover:bg-[#0F0F0F]"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/claims/${c.id}`}
                      className="font-mono text-xs tracking-wide text-paper hover:underline"
                    >
                      {c.claimNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-paper/90">{c.primaryClaimant}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {LOSS_TYPE_LABELS[c.lossType]}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {format(new Date(c.dateOfLoss), "yyyy-MM-dd")}
                  </td>
                  <td className="px-3 py-3 text-paper/80">
                    {c.adjusterName ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {daysOpen(c.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs">
                    {formatCurrency(c.estimatedValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
