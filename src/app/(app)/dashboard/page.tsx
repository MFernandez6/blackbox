import { Suspense } from "react";
import type { ClaimStatus, LossType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/claims/labels";
import {
  DashboardClient,
  type DashboardClaimRow,
} from "@/components/claims/dashboard-client";
import { DashboardMyWork } from "@/components/claims/dashboard-my-work";
import { DashboardSkeleton } from "@/components/claims/dashboard-skeleton";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  status?: string;
  adjuster?: string;
  lossType?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
};

async function DashboardData({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) return null;

  const statuses = (searchParams.status?.split(",").filter(Boolean) ??
    []) as ClaimStatus[];
  const lossType = searchParams.lossType as LossType | undefined;
  const sort = searchParams.sort ?? "updatedAt";
  const dir = searchParams.dir === "asc" ? "asc" : "desc";

  const scopeWhere: Prisma.ClaimWhereInput = {
    isArchived: false,
  };
  if (session.user.role === "ADJUSTER") {
    scopeWhere.assignedAdjusterId = session.user.id;
  }

  const where: Prisma.ClaimWhereInput = { ...scopeWhere };

  if (statuses.length) where.status = { in: statuses };
  if (searchParams.adjuster) where.assignedAdjusterId = searchParams.adjuster;
  if (lossType) where.lossType = lossType;
  if (searchParams.from || searchParams.to) {
    where.dateOfLoss = {};
    if (searchParams.from) where.dateOfLoss.gte = new Date(searchParams.from);
    if (searchParams.to) where.dateOfLoss.lte = new Date(searchParams.to);
  }
  if (searchParams.q) {
    const q = searchParams.q.trim();
    where.OR = [
      { claimNumber: { contains: q, mode: "insensitive" } },
      { insurerClaimNumber: { contains: q, mode: "insensitive" } },
      { policyNumber: { contains: q, mode: "insensitive" } },
      { carrierName: { contains: q, mode: "insensitive" } },
      { propertyAddress: { contains: q, mode: "insensitive" } },
      { county: { contains: q, mode: "insensitive" } },
      { zipCode: { contains: q, mode: "insensitive" } },
      {
        claimants: {
          some: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const orderBy: Prisma.ClaimOrderByWithRelationInput = (() => {
    switch (sort) {
      case "claimNumber":
        return { claimNumber: dir };
      case "insurerClaimNumber":
        return { insurerClaimNumber: dir };
      case "status":
        return { status: dir };
      case "lossType":
        return { lossType: dir };
      case "dateOfLoss":
        return { dateOfLoss: dir };
      case "estimatedValue":
        return { estimatedValue: dir };
      case "adjuster":
        return { assignedAdjuster: { name: dir } };
      case "daysOpen":
      case "createdAt":
        return { createdAt: dir };
      case "claimant":
        return { updatedAt: dir };
      default:
        return { updatedAt: dir };
    }
  })();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 7);

  const taskWhere: Prisma.ClaimTaskWhereInput = {
    status: { in: ["OPEN", "IN_PROGRESS"] },
    claim: scopeWhere,
    OR: [
      { assignedToId: session.user.id },
      ...(session.user.role === "ADMIN"
        ? [{ assignedToId: null as string | null }]
        : []),
    ],
  };

  const [
    claims,
    adjusters,
    statusGroups,
    openAgg,
    myTasks,
    openClaimsForDates,
    unassignedClaims,
    recentNotes,
  ] = await Promise.all([
    prisma.claim.findMany({
      where,
      orderBy,
      include: {
        claimants: { where: { isPrimaryContact: true }, take: 1 },
        assignedAdjuster: { select: { name: true } },
      },
    }),
    prisma.adjuster.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "ADJUSTER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.claim.groupBy({
      by: ["status"],
      where: scopeWhere,
      _count: { _all: true },
    }),
    prisma.claim.aggregate({
      where: {
        ...scopeWhere,
        status: { in: OPEN_STATUSES },
      },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
    prisma.claimTask.findMany({
      where: taskWhere,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: { claim: { select: { id: true, claimNumber: true } } },
    }),
    prisma.claim.findMany({
      where: {
        ...scopeWhere,
        status: { in: OPEN_STATUSES },
        OR: [
          { scheduledAppointmentDate: { lt: today } },
          { initialContactDate: null },
          { estimateSentDate: null, estimateCreatedDate: { lt: today } },
        ],
      },
      select: {
        id: true,
        claimNumber: true,
        status: true,
        scheduledAppointmentDate: true,
        initialContactDate: true,
        estimateCreatedDate: true,
        estimateSentDate: true,
      },
      take: 20,
    }),
    session.user.role === "ADMIN"
      ? prisma.claim.findMany({
          where: {
            isArchived: false,
            assignedAdjusterId: null,
            status: { in: OPEN_STATUSES },
          },
          select: {
            id: true,
            claimNumber: true,
            status: true,
            propertyAddress: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.claimNote.findMany({
      where: { claim: scopeWhere },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        claim: { select: { id: true, claimNumber: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const overdueDates = openClaimsForDates.flatMap((c) => {
    const rows: Array<{
      claimId: string;
      claimNumber: string;
      label: string;
      date: string;
      status: ClaimStatus;
    }> = [];
    if (
      c.scheduledAppointmentDate &&
      c.scheduledAppointmentDate < today
    ) {
      rows.push({
        claimId: c.id,
        claimNumber: c.claimNumber,
        label: "Scheduled appointment overdue",
        date: c.scheduledAppointmentDate.toISOString(),
        status: c.status,
      });
    }
    if (
      c.estimateCreatedDate &&
      !c.estimateSentDate &&
      c.estimateCreatedDate < today
    ) {
      rows.push({
        claimId: c.id,
        claimNumber: c.claimNumber,
        label: "Estimate created — not sent",
        date: c.estimateCreatedDate.toISOString(),
        status: c.status,
      });
    }
    return rows;
  }).slice(0, 8);

  const rows: DashboardClaimRow[] = claims.map((c) => {
    const primary = c.claimants[0];
    return {
      id: c.id,
      claimNumber: c.claimNumber,
      insurerClaimNumber: c.insurerClaimNumber,
      status: c.status,
      lossType: c.lossType,
      dateOfLoss: c.dateOfLoss.toISOString(),
      estimatedValue: c.estimatedValue?.toString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      primaryClaimant: primary
        ? `${primary.firstName} ${primary.lastName}`
        : "—",
      adjusterName: c.assignedAdjuster?.name ?? null,
      assignedAdjusterId: c.assignedAdjusterId,
    };
  });

  if (sort === "claimant") {
    rows.sort((a, b) => {
      const cmp = a.primaryClaimant.localeCompare(b.primaryClaimant);
      return dir === "asc" ? cmp : -cmp;
    });
  }
  if (sort === "daysOpen") {
    rows.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return dir === "asc" ? da - db : db - da;
    });
  }

  const byStatus: Partial<Record<ClaimStatus, number>> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
  }

  return (
    <div className="space-y-6">
      <DashboardMyWork
        showUnassigned={session.user.role === "ADMIN"}
        tasks={myTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate?.toISOString() ?? null,
          claimId: t.claim.id,
          claimNumber: t.claim.claimNumber,
        }))}
        overdueDates={overdueDates}
        unassigned={unassignedClaims.map((c) => ({
          id: c.id,
          claimNumber: c.claimNumber,
          status: c.status,
          propertyAddress: c.propertyAddress,
        }))}
        notes={recentNotes.map((n) => ({
          id: n.id,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          claimId: n.claim.id,
          claimNumber: n.claim.claimNumber,
          authorName: n.createdBy.name,
        }))}
      />
      <DashboardClient
        claims={rows}
        summary={{
          openCount: openAgg._count._all,
          byStatus,
          pipelineValue: Number(openAgg._sum.estimatedValue ?? 0),
        }}
        adjusters={adjusters}
        canCreate={canEdit(session.user.role)}
        canEditClaims={canEdit(session.user.role)}
        canManage={session.user.role === "ADMIN"}
        role={session.user.role}
        currentUserId={session.user.id}
      />
    </div>
  );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData searchParams={searchParams} />
    </Suspense>
  );
}
