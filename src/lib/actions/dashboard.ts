"use server";

import { revalidatePath } from "next/cache";
import { requireSession, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/claims";

async function assertCanEditClaim(claimId: string) {
  const session = await requireSession();
  if (!canEdit(session.user.role)) {
    return { session, error: "Insufficient privileges." as const };
  }
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, assignedAdjusterId: true, isArchived: true },
  });
  if (!claim) return { session, error: "Claim not found." as const };
  if (claim.isArchived) {
    return { session, error: "Archived files are sealed." as const };
  }
  if (
    session.user.role === "ADJUSTER" &&
    claim.assignedAdjusterId !== session.user.id
  ) {
    return { session, error: "Not assigned to this file." as const };
  }
  return { session, claim, error: null };
}

export async function bulkArchiveClaimsAction(
  ids: string[]
): Promise<ActionResult<{ count: number }>> {
  try {
    if (!ids.length) {
      return { ok: false, error: "No files selected." };
    }

    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to archive." };
    }

    let count = 0;
    for (const id of ids) {
      const claim = await prisma.claim.findUnique({
        where: { id },
        select: { id: true, assignedAdjusterId: true, isArchived: true },
      });
      if (!claim || claim.isArchived) continue;
      if (
        session.user.role === "ADJUSTER" &&
        claim.assignedAdjusterId !== session.user.id
      ) {
        continue;
      }
      await prisma.claim.update({
        where: { id },
        data: { isArchived: true },
      });
      count++;
      revalidatePath(`/claims/${id}`);
    }

    revalidatePath("/dashboard");
    return { ok: true, data: { count } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Bulk archive failed." };
  }
}

export async function assignClaimAdjusterAction(
  claimId: string,
  adjusterId: string | null
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error) return { ok: false, error: gate.error };

    if (adjusterId) {
      const adjuster = await prisma.adjuster.findFirst({
        where: {
          id: adjusterId,
          isActive: true,
          role: { in: ["ADMIN", "ADJUSTER"] },
        },
      });
      if (!adjuster) {
        return { ok: false, error: "Adjuster not found." };
      }
    }

    await prisma.claim.update({
      where: { id: claimId },
      data: { assignedAdjusterId: adjusterId },
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Assignment failed." };
  }
}

export async function bulkAssignClaimsAction(
  ids: string[],
  adjusterId: string | null
): Promise<ActionResult<{ count: number }>> {
  try {
    if (!ids.length) {
      return { ok: false, error: "No files selected." };
    }

    if (adjusterId) {
      const adjuster = await prisma.adjuster.findFirst({
        where: {
          id: adjusterId,
          isActive: true,
          role: { in: ["ADMIN", "ADJUSTER"] },
        },
      });
      if (!adjuster) {
        return { ok: false, error: "Adjuster not found." };
      }
    }

    let count = 0;
    for (const id of ids) {
      const gate = await assertCanEditClaim(id);
      if (gate.error) continue;

      await prisma.claim.update({
        where: { id },
        data: { assignedAdjusterId: adjusterId },
      });
      count++;
      revalidatePath(`/claims/${id}`);
    }

    revalidatePath("/dashboard");
    return { ok: true, data: { count } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Bulk assignment failed." };
  }
}
