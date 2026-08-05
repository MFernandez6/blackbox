import { Suspense } from "react";
import type { ClaimStatus, LossType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/claims/labels";
import {
  DashboardClient,
  type DashboardClaimRow,
} from "@/components/claims/dashboard-client";
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

  const where: Prisma.ClaimWhereInput = {
    isArchived: false,
  };

  if (session.user.role === "ADJUSTER") {
    where.assignedAdjusterId = session.user.id;
  }

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

  const [claims, adjusters, statusGroups, openAgg] = await Promise.all([
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
      where: { isArchived: false },
      _count: { _all: true },
    }),
    prisma.claim.aggregate({
      where: {
        isArchived: false,
        status: { in: OPEN_STATUSES },
      },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
  ]);

  const rows: DashboardClaimRow[] = claims.map((c) => {
    const primary = c.claimants[0];
    return {
      id: c.id,
      claimNumber: c.claimNumber,
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
    <DashboardClient
      claims={rows}
      summary={{
        openCount: openAgg._count._all,
        byStatus,
        pipelineValue: Number(openAgg._sum.estimatedValue ?? 0),
      }}
      adjusters={adjusters}
      canCreate={canEdit(session.user.role)}
    />
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
