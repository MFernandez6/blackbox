import type { PrismaClient, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Atomically allocate the next BB-YYYY-#### claim number for the given year.
 * Must be called inside the same transaction that creates the Claim.
 */
export async function allocateClaimNumber(
  tx: Tx,
  year: number = new Date().getFullYear()
): Promise<string> {
  const row = await tx.claimNumberSequence.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return `BB-${year}-${String(row.lastValue).padStart(4, "0")}`;
}
