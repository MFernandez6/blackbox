"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSession, canEdit, canManagePayments } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { demandSettlementUpdateSchema } from "@/lib/schemas/demand-settlement";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toDecimal(
  value: number | null | undefined
): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

export async function updateDemandSettlementAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role) && !canManagePayments(session.user.role)) {
      return { ok: false, error: "Insufficient privileges." };
    }

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { assignedAdjusterId: true, isArchived: true },
    });
    if (!claim) return { ok: false, error: "Claim not found." };
    if (claim.isArchived) {
      return { ok: false, error: "Archived files are sealed." };
    }
    if (
      session.user.role === "ADJUSTER" &&
      claim.assignedAdjusterId !== session.user.id
    ) {
      return { ok: false, error: "Not assigned to this file." };
    }

    const parsed = demandSettlementUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const d = parsed.data;
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        demandAmount: toDecimal(d.demandAmount),
        demandSentDate: parseDate(d.demandSentDate),
        rcvAmount: toDecimal(d.rcvAmount),
        acvAmount: toDecimal(d.acvAmount),
        settlementAmount: toDecimal(d.settlementAmount),
        settlementDate: parseDate(d.settlementDate),
        settlementNotes: d.settlementNotes || null,
      },
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath(`/claims/${claimId}/print`);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to update demand / settlement." };
  }
}
