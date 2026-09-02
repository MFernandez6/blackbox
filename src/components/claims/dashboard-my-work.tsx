"use client";

import Link from "next/link";
import { format, isBefore, startOfDay } from "date-fns";
import { STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/claims/labels";
import type { ClaimStatus, TaskStatus } from "@prisma/client";
import { StatusBadge } from "@/components/claims/status-badge";

export type MyWorkTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  claimId: string;
  claimNumber: string;
};

export type MyWorkDateAlert = {
  claimId: string;
  claimNumber: string;
  label: string;
  date: string | null;
  status: ClaimStatus;
};

export type MyWorkFile = {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  title: string;
  hint: string;
  href?: string;
};

export type MyWorkNote = {
  id: string;
  body: string;
  createdAt: string;
  claimId: string;
  claimNumber: string;
  authorName: string;
};

type WorkRow = {
  key: string;
  queue: string;
  href: string;
  claimNumber: string;
  title: string;
  detail: string;
  status?: ClaimStatus;
  alert?: boolean;
};

type Props = {
  assigned: MyWorkFile[];
  tasks: MyWorkTask[];
  overdueDates: MyWorkDateAlert[];
  notes: MyWorkNote[];
  recent: MyWorkFile[];
};

export function DashboardMyWork({
  assigned,
  tasks,
  overdueDates,
  notes,
  recent,
}: Props) {
  const today = startOfDay(new Date());
  const assignedIds = new Set(assigned.map((c) => c.id));
  const recentOnly = recent.filter((c) => !assignedIds.has(c.id));

  const rows: WorkRow[] = [
    ...assigned.map((c) => ({
      key: `assigned-${c.id}`,
      queue: "Assigned",
      href: `/claims/${c.id}`,
      claimNumber: c.claimNumber,
      title: c.title,
      detail: c.hint,
      status: c.status,
    })),
    ...overdueDates.map((d) => ({
      key: `attention-${d.claimId}-${d.label}`,
      queue: "Attention",
      href: `/claims/${d.claimId}?tab=dates`,
      claimNumber: d.claimNumber,
      title: d.label,
      detail: d.date
        ? format(new Date(d.date), "MMM d, yyyy")
        : STATUS_LABELS[d.status],
      status: d.status,
      alert: true,
    })),
    ...tasks.map((t) => {
      const overdue =
        !!t.dueDate && isBefore(startOfDay(new Date(t.dueDate)), today);
      return {
        key: `task-${t.id}`,
        queue: "Task",
        href: `/claims/${t.claimId}?tab=tasks`,
        claimNumber: t.claimNumber,
        title: t.title,
        detail: `${TASK_STATUS_LABELS[t.status]}${
          t.dueDate ? ` · ${format(new Date(t.dueDate), "MMM d")}` : ""
        }${overdue ? " · Overdue" : ""}`,
        alert: overdue,
      };
    }),
    ...(notes.length
      ? notes.map((n) => ({
          key: `note-${n.id}`,
          queue: "Note",
          href: `/claims/${n.claimId}?tab=activity`,
          claimNumber: n.claimNumber,
          title: n.body,
          detail: `${n.authorName} · ${format(new Date(n.createdAt), "MMM d")}`,
        }))
      : recentOnly.map((c) => ({
          key: `recent-${c.id}`,
          queue: "Recent",
          href: `/claims/${c.id}`,
          claimNumber: c.claimNumber,
          title: c.title,
          detail: c.hint,
          status: c.status,
        }))),
  ];

  if (rows.length === 0) return null;

  return (
    <section className="space-y-8">
      <div>
        <p className="eyebrow">Desk</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
          My Work
        </h2>
      </div>

      <div className="space-y-2 lg:hidden">
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="border border-brand-white/10 bg-brand-navy-deep/30">
              <Link href={row.href} className="block px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs tracking-wide text-brand-gold">
                      {row.claimNumber}
                    </p>
                    <p className="mt-1 truncate text-sm text-brand-white">
                      {row.title}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                      {row.queue} · {row.detail}
                    </p>
                  </div>
                  {row.status ? (
                    <StatusBadge status={row.status} className="shrink-0" />
                  ) : row.alert ? (
                    <span className="shrink-0 font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-denied">
                      Overdue
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden overflow-x-auto border border-brand-white/10 lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-white/10 bg-brand-navy-deep/50">
              <th className="px-3 py-2.5 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Queue
              </th>
              <th className="px-3 py-2.5 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                BL Claim #
              </th>
              <th className="px-3 py-2.5 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Item
              </th>
              <th className="px-3 py-2.5 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Detail
              </th>
              <th className="px-3 py-2.5 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-brand-white/10 last:border-0 hover:bg-brand-gold/5"
              >
                <td className="px-3 py-2.5 align-middle font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  {row.queue}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <Link
                    href={row.href}
                    className="font-mono text-xs tracking-wide text-brand-gold hover:underline"
                  >
                    {row.claimNumber}
                  </Link>
                </td>
                <td className="px-3 py-2.5 align-middle text-brand-white/90">
                  <Link href={row.href} className="hover:text-brand-white">
                    {row.title}
                  </Link>
                </td>
                <td
                  className={`px-3 py-2.5 align-middle font-mono text-xs ${
                    row.alert ? "text-denied" : "text-brand-slate"
                  }`}
                >
                  {row.detail}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {row.status ? <StatusBadge status={row.status} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
