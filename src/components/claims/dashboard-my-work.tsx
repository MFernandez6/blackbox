"use client";

import Link from "next/link";
import { format, isBefore, startOfDay } from "date-fns";
import { STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/claims/labels";
import type { ClaimStatus, TaskStatus } from "@prisma/client";

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
  date: string;
  status: ClaimStatus;
};

export type MyWorkUnassigned = {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  propertyAddress: string;
};

export type MyWorkNote = {
  id: string;
  body: string;
  createdAt: string;
  claimId: string;
  claimNumber: string;
  authorName: string;
};

type Props = {
  tasks: MyWorkTask[];
  overdueDates: MyWorkDateAlert[];
  unassigned: MyWorkUnassigned[];
  notes: MyWorkNote[];
  showUnassigned: boolean;
};

export function DashboardMyWork({
  tasks,
  overdueDates,
  unassigned,
  notes,
  showUnassigned,
}: Props) {
  const today = startOfDay(new Date());

  return (
    <section className="space-y-4 border border-brand-white/10 p-4 sm:p-5">
      <div>
        <p className="eyebrow">My Work</p>
        <p className="mt-1 text-sm text-brand-slate">
          Due tasks, overdue claim dates
          {showUnassigned ? ", unassigned files" : ""}, and recent notes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <WorkColumn
          title="Due / Open Tasks"
          empty="No open tasks assigned to you."
          items={tasks.map((t) => {
            const overdue =
              t.dueDate &&
              isBefore(startOfDay(new Date(t.dueDate)), today);
            return (
              <Link
                key={t.id}
                href={`/claims/${t.claimId}?tab=tasks`}
                className="block border border-brand-white/10 p-3 hover:border-brand-gold/40"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-brand-gold">
                  {t.claimNumber}
                </p>
                <p className="mt-1 text-sm text-brand-white">{t.title}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                  {TASK_STATUS_LABELS[t.status]}
                  {t.dueDate
                    ? ` · Due ${format(new Date(t.dueDate), "MMM d")}`
                    : ""}
                  {overdue ? " · Overdue" : ""}
                </p>
              </Link>
            );
          })}
        />

        <WorkColumn
          title="Overdue Claim Dates"
          empty="No overdue ops dates."
          items={overdueDates.map((d) => (
            <Link
              key={`${d.claimId}-${d.label}`}
              href={`/claims/${d.claimId}?tab=dates`}
              className="block border border-brand-white/10 p-3 hover:border-brand-gold/40"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-brand-gold">
                {d.claimNumber}
              </p>
              <p className="mt-1 text-sm text-brand-white">{d.label}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-denied">
                {format(new Date(d.date), "MMM d, yyyy")} ·{" "}
                {STATUS_LABELS[d.status]}
              </p>
            </Link>
          ))}
        />

        {showUnassigned ? (
          <WorkColumn
            title="Unassigned Files"
            empty="All open files assigned."
            items={unassigned.map((c) => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                className="block border border-brand-white/10 p-3 hover:border-brand-gold/40"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-brand-gold">
                  {c.claimNumber}
                </p>
                <p className="mt-1 truncate text-sm text-brand-white">
                  {c.propertyAddress}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                  {STATUS_LABELS[c.status]}
                </p>
              </Link>
            ))}
          />
        ) : null}

        <WorkColumn
          title="Recent Notes"
          empty="No recent notes on your files."
          items={notes.map((n) => (
            <Link
              key={n.id}
              href={`/claims/${n.claimId}?tab=activity`}
              className="block border border-brand-white/10 p-3 hover:border-brand-gold/40"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-brand-gold">
                {n.claimNumber}
              </p>
              <p className="mt-1 line-clamp-3 text-sm text-brand-white">
                {n.body}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                {n.authorName} · {format(new Date(n.createdAt), "MMM d")}
              </p>
            </Link>
          ))}
        />
      </div>
    </section>
  );
}

function WorkColumn({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: React.ReactNode[];
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
        {title}
      </p>
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="border border-dashed border-brand-white/10 px-3 py-6 text-center text-xs text-brand-slate">
            {empty}
          </li>
        ) : (
          items.map((item, i) => <li key={i}>{item}</li>)
        )}
      </ul>
    </div>
  );
}
