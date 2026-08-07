"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { AdjusterRole, ClaimStatus, LossType } from "@prisma/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  bulkArchiveClaimsAction,
  assignClaimAdjusterAction,
  bulkAssignClaimsAction,
} from "@/lib/actions/dashboard";
import { cn, daysOpen, formatCurrency } from "@/lib/utils";

export type DashboardClaimRow = {
  id: string;
  claimNumber: string;
  insurerClaimNumber: string | null;
  status: ClaimStatus;
  lossType: LossType;
  dateOfLoss: string;
  estimatedValue: string | null;
  updatedAt: string;
  createdAt: string;
  primaryClaimant: string;
  adjusterName: string | null;
  assignedAdjusterId: string | null;
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
  canEditClaims: boolean;
  canManage: boolean;
  role: AdjusterRole;
  currentUserId: string;
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ClaimStatus[];
const ALL_LOSS = Object.keys(LOSS_TYPE_LABELS) as LossType[];

export function DashboardClient({
  claims,
  summary,
  adjusters,
  canCreate,
  canEditClaims,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAdjuster, setBulkAdjuster] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const allSelected = claims.length > 0 && selected.size === claims.length;
  const someSelected = selected.size > 0;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(claims.map((c) => c.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleBulkArchive() {
    if (!someSelected) return;
    if (
      !confirm(
        `Archive ${selected.size} selected file${selected.size === 1 ? "" : "s"}? Records will be retained.`
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await bulkArchiveClaimsAction(Array.from(selected));
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.count} file${result.data.count === 1 ? "" : "s"} archived`);
    setSelected(new Set());
    router.refresh();
  }

  async function handleBulkAssign() {
    if (!someSelected || !bulkAdjuster) return;
    setBusy(true);
    const adjusterId = bulkAdjuster === "none" ? null : bulkAdjuster;
    const result = await bulkAssignClaimsAction(Array.from(selected), adjusterId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.count} file${result.data.count === 1 ? "" : "s"} reassigned`);
    setSelected(new Set());
    setBulkAdjuster("");
    router.refresh();
  }

  async function handleRowAssign(claimId: string, value: string) {
    const adjusterId = value === "none" ? null : value;
    const result = await assignClaimAdjusterAction(claimId, adjusterId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Adjuster updated");
    router.refresh();
  }

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
      <th className={cn("px-3 py-2.5 text-left align-middle", className)}>
        <Link
          href={sortLink(col)}
          className={cn(
            "inline-block font-sans text-[10px] font-bold uppercase tracking-[0.2em] hover:text-brand-gold",
            active ? "text-brand-white" : "text-brand-slate"
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
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
            Active Files
          </h1>
        </div>
        {canCreate ? (
          <Button asChild variant="solid">
            <Link href="/claims/new">+ New Claim</Link>
          </Button>
        ) : null}
      </div>

      {/* Summary strip */}
      <div className="grid gap-0 border border-brand-white/10 md:grid-cols-3">
        <div className="border-b border-brand-white/10 px-5 py-4 md:border-b-0 md:border-r">
          <p className="eyebrow">Open Pipeline</p>
          <p className="mt-2 font-mono text-2xl text-brand-white">{summary.openCount}</p>
        </div>
        <div className="border-b border-brand-white/10 px-5 py-4 md:border-b-0 md:border-r">
          <p className="eyebrow">By Status</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {OPEN_STATUSES.map((s) => (
              <span key={s} className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                {STATUS_LABELS[s]}{" "}
                <span className="text-brand-white">{summary.byStatus[s] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="eyebrow">Estimated Value</p>
          <p className="mt-2 font-mono text-2xl text-brand-white">
            {formatCurrency(summary.pipelineValue)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 border border-brand-white/10 p-4">
        <p className="eyebrow">File Integrity — Filters</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              defaultValue={searchParams.get("q") ?? ""}
              placeholder="BL #, NI #, claimant, policy, carrier, address…"
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
          <div className="grid gap-2 sm:grid-cols-2">
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
                  "border px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em]",
                  active
                    ? "border-brand-gold bg-brand-gold text-brand-navy"
                    : "border-brand-white/10 text-brand-slate hover:border-brand-gold/40"
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {canEditClaims && someSelected ? (
        <div className="no-print flex flex-wrap items-center gap-3 border border-brand-gold/30 bg-brand-gold/5 px-4 py-3">
          <p className="eyebrow text-brand-gold">
            {selected.size} selected
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={handleBulkArchive}
          >
            Archive selected
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bulkAdjuster} onValueChange={setBulkAdjuster}>
              <SelectTrigger className="h-8 w-full min-w-0 sm:w-[160px]">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {adjusters.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !bulkAdjuster}
              onClick={handleBulkAssign}
            >
              Assign selected
            </Button>
          </div>
        </div>
      ) : null}

      {/* Claims list — mobile cards + desktop table */}
      <div className={cn((pending || busy) && "opacity-60")}>
        {claims.length === 0 ? (
          <div className="border border-brand-white/10 px-6 py-16 text-center">
            <p className="eyebrow mb-3">Secure Record</p>
            <p className="text-sm text-brand-slate">
              No active files. Begin intake to open the first record.
            </p>
            {canCreate ? (
              <Button asChild className="mt-6" variant="outline">
                <Link href="/claims/new">Open Intake</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Mobile / tablet: vertical collapsible cards */}
            <div className="space-y-2 lg:hidden">
              {canEditClaims ? (
                <div className="flex items-center gap-3 border border-brand-white/10 px-3 py-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => toggleAll(!!c)}
                    aria-label="Select all"
                  />
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                    Select all files
                  </p>
                </div>
              ) : null}
              <ul className="space-y-2">
                {claims.map((c) => {
                  const open = expanded.has(c.id);
                  return (
                    <li
                      key={c.id}
                      className="border border-brand-white/10 bg-brand-navy-deep/30"
                    >
                      <div className="flex items-start gap-2 px-3 py-3">
                        {canEditClaims ? (
                          <Checkbox
                            className="mt-1"
                            checked={selected.has(c.id)}
                            onCheckedChange={(checked) =>
                              toggleOne(c.id, !!checked)
                            }
                            aria-label={`Select ${c.claimNumber}`}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => toggleExpanded(c.id)}
                          aria-expanded={open}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs tracking-wide text-brand-gold">
                                {c.claimNumber}
                              </p>
                              <p className="mt-1 truncate text-sm text-brand-white">
                                {c.primaryClaimant}
                              </p>
                              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                                {LOSS_TYPE_LABELS[c.lossType]} ·{" "}
                                {format(new Date(c.dateOfLoss), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <StatusBadge status={c.status} />
                              <span className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                                {open ? "Collapse ▲" : "Expand ▼"}
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>

                      {open ? (
                        <div className="space-y-3 border-t border-brand-white/10 px-3 py-3">
                          <dl className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                                NI Claim #
                              </dt>
                              <dd className="mt-1 font-mono text-xs text-brand-white/90">
                                {c.insurerClaimNumber ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                                Days open
                              </dt>
                              <dd className="mt-1 font-mono text-xs text-brand-white/90">
                                {daysOpen(c.createdAt)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                                Est. value
                              </dt>
                              <dd className="mt-1 font-mono text-xs text-brand-white/90">
                                {formatCurrency(c.estimatedValue)}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                                Adjuster
                              </dt>
                              <dd className="mt-1 text-xs text-brand-white/90">
                                {c.adjusterName ?? "Unassigned"}
                              </dd>
                            </div>
                          </dl>

                          {canEditClaims ? (
                            <div className="space-y-1.5">
                              <Label>Reassign</Label>
                              <Select
                                value={c.assignedAdjusterId ?? "none"}
                                onValueChange={(v) => handleRowAssign(c.id, v)}
                              >
                                <SelectTrigger className="h-9 w-full border-brand-white/10 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {adjusters.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          <Button asChild size="sm" variant="solid" className="w-full">
                            <Link href={`/claims/${c.id}`}>Open file</Link>
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto border border-brand-white/10 lg:block">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-brand-white/10 bg-brand-navy-deep/50">
                    {canEditClaims ? (
                      <th className="w-10 px-3 py-2.5 text-left align-middle">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(c) => toggleAll(!!c)}
                          aria-label="Select all"
                        />
                      </th>
                    ) : null}
                    <SortHeader col="claimNumber" label="BL Claim #" />
                    <SortHeader col="insurerClaimNumber" label="NI Claim #" />
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
                      className="border-b border-brand-white/10 last:border-0 hover:bg-brand-gold/5"
                    >
                      {canEditClaims ? (
                        <td className="w-10 px-3 py-2.5 align-middle">
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={(checked) =>
                              toggleOne(c.id, !!checked)
                            }
                            aria-label={`Select ${c.claimNumber}`}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5 align-middle">
                        <Link
                          href={`/claims/${c.id}`}
                          className="font-mono text-xs tracking-wide text-brand-gold hover:underline"
                        >
                          {c.claimNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 align-middle font-mono text-xs text-brand-white/80">
                        {c.insurerClaimNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-brand-white/90">
                        {c.primaryClaimant}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2.5 align-middle font-mono text-xs uppercase tracking-wider text-brand-slate">
                        {LOSS_TYPE_LABELS[c.lossType]}
                      </td>
                      <td className="px-3 py-2.5 align-middle font-mono text-xs text-brand-slate">
                        {format(new Date(c.dateOfLoss), "yyyy-MM-dd")}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {canEditClaims ? (
                          <Select
                            value={c.assignedAdjusterId ?? "none"}
                            onValueChange={(v) => handleRowAssign(c.id, v)}
                          >
                            <SelectTrigger className="h-7 w-full min-w-0 border-brand-white/10 text-xs sm:min-w-[120px] sm:w-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {adjusters.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-brand-white/80">
                            {c.adjusterName ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle font-mono text-xs">
                        {daysOpen(c.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-right font-mono text-xs">
                        {formatCurrency(c.estimatedValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
