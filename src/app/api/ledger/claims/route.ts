import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Read-only financial export for BLACKLEDGER.
 * Never accepts writes. Claim status remains owned by this product.
 */

function authorized(req: NextRequest, hasSession: boolean): boolean {
  if (hasSession) return true;
  const keys = [
    process.env.BLACKLEDGER_API_KEY,
    process.env.BLACKBOX_API_KEY,
  ].filter((key): key is string => !!key);
  if (keys.length === 0) return false;
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  return !!token && keys.includes(token);
}

function money(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!authorized(req, !!session?.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
