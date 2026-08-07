import { requireSession, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function assertCanEditClaim(claimId: string) {
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

export async function assertCanViewClaim(claimId: string) {
  const session = await requireSession();
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, assignedAdjusterId: true },
  });
  if (!claim) return { session, error: "Claim not found." as const };
  if (
    session.user.role === "ADJUSTER" &&
    claim.assignedAdjusterId !== session.user.id
  ) {
    return { session, error: "Not assigned to this file." as const };
  }
  return { session, claim, error: null };
}
