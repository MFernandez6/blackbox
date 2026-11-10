import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { serviceKeyAuthorized } from "@/lib/integrations/service-auth";
import { prisma } from "@/lib/prisma";

/**
 * Read-only financial export for BLACKLEDGER.
 * Never accepts writes. Claim status remains owned by this product.
 */

function serviceAuthorized(req: NextRequest): boolean {
  return serviceKeyAuthorized(req, [process.env.BLACKLEDGER_API_KEY, process.env.BLACKBOX_API_KEY]);
}

function money(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  if (!serviceAuthorized(req)) {
    const session = await getSession();
    if (session?.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const claims = await prisma.claim.findMany({
    where: { isArchived: false },
    include: {
      claimants: { where: { isPrimaryContact: true }, take: 1 },
      assignedAdjuster: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    claims: claims.map((c) => ({
      id: c.id,
      claimNumber: c.claimNumber,
      status: c.status,
      lossType: c.lossType,
      isCatClaim: c.isCatClaim,
      dateOfLoss: c.dateOfLoss.toISOString().slice(0, 10),
      propertyAddress: c.propertyAddress,
      county: c.county,
      zipCode: c.zipCode,
      carrierName: c.carrierName,
      policyNumber: c.policyNumber,
      estimatedValue: money(c.estimatedValue),
      demandAmount: money(c.demandAmount),
      settlementAmount: money(c.settlementAmount),
      settlementDate: c.settlementDate
        ? c.settlementDate.toISOString().slice(0, 10)
        : null,
      contingencyFeePercent: money(c.contingencyFeePercent) ?? 20,
      assignedAdjuster: c.assignedAdjuster?.name ?? null,
      primaryClaimant: c.claimants[0]
        ? `${c.claimants[0].firstName} ${c.claimants[0].lastName}`
        : "—",
    })),
  });
}

function reject() {
  return NextResponse.json(
    { error: "BLACKBOX ledger export is read-only." },
    { status: 405 }
  );
}

export function POST() {
  return reject();
}
export function PUT() {
  return reject();
}
export function PATCH() {
  return reject();
}
export function DELETE() {
  return reject();
}
