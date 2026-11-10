"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertCanEditClaim } from "@/lib/claims/access";
import { logClaimAudit } from "@/lib/claims/audit";
import { computeFeeCap } from "@/lib/compliance/florida-pa";
import {
  claimComplianceSchema,
  emergencyDeclarationSchema,
  type ClaimComplianceInput,
} from "@/lib/schemas/claim";
import type { ActionResult } from "@/lib/actions/claims";

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

export async function updateClaimComplianceAction(
  claimId: string,
  raw: ClaimComplianceInput
): Promise<ActionResult<{ capPercent: number }>> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error) return { ok: false, error: gate.error };

    const parsed = claimComplianceSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    }
    const d = parsed.data;

    const declaration = d.emergencyDeclarationId
      ? await prisma.emergencyDeclaration.findUnique({
          where: { id: d.emergencyDeclarationId },
          select: { id: true, declaredDate: true, name: true },
        })
      : null;
    if (d.emergencyDeclarationId && !declaration) {
      return { ok: false, error: "Emergency declaration not found." };
    }
    const isEmergencyLoss = d.isCatClaim || !!declaration;

    const executed = dateOrNull(d.contractExecutedDate);
    const sent = dateOrNull(d.contractSentToInsurerDate);
    const cancelled = dateOrNull(d.contractCancelledDate);
    if (sent && !executed) {
      return { ok: false, error: "Record the contract execution date before the insurer delivery date." };
    }
    if (cancelled && !executed) {
      return { ok: false, error: "A contract must be executed before it can be cancelled." };
    }
    if (executed && executed > new Date()) {
      return { ok: false, error: "Contract execution date cannot be in the future." };
    }

    const cap = computeFeeCap({
      isEmergencyLoss,
      emergencyDeclaredDate: declaration?.declaredDate ?? null,
      claimReportedDate: d.claimReportedDate,
      isReopenedClaim: d.isReopenedClaim,
    });

    const before = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { contingencyFeePercent: true, contractExecutedDate: true, contractCancelledDate: true },
    });

    await prisma.claim.update({
      where: { id: claimId },
      data: {
        isCatClaim: cap.emergencyCapApplies,
        emergencyDeclarationId: declaration?.id ?? null,
        claimReportedDate: dateOrNull(d.claimReportedDate),
        isReopenedClaim: d.isReopenedClaim,
        priorInsurerPayments:
          d.priorInsurerPayments === null ? null : new Prisma.Decimal(d.priorInsurerPayments),
        contractExecutedDate: executed,
        contractSentToInsurerDate: sent,
        contractCancelledDate: cancelled,
        contingencyFeePercent: new Prisma.Decimal(cap.capPercent),
      },
    });

    const changes: string[] = [];
    if (Number(before?.contingencyFeePercent ?? 0) !== cap.capPercent) {
      changes.push(`fee cap ${before?.contingencyFeePercent?.toString() ?? "—"}% → ${cap.capPercent}%`);
    }
    if (!before?.contractExecutedDate && executed) changes.push("contract executed");
    if (!before?.contractCancelledDate && cancelled) changes.push("contract cancelled by insured");

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "COMPLIANCE_UPDATE",
      entityType: "Claim",
      entityId: claimId,
      summary: `Updated PA contract & fee compliance${changes.length ? ` (${changes.join("; ")})` : ""}`,
      meta: { capPercent: cap.capPercent, basis: cap.basis, declaration: declaration?.name ?? null },
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { capPercent: cap.capPercent } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Compliance update failed." };
  }
}

async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

export async function saveEmergencyDeclarationAction(
  id: string | null,
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const parsed = emergencyDeclarationSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    }
    const d = parsed.data;
    const data = {
      name: d.name,
      executiveOrder: d.executiveOrder || null,
      declaredDate: new Date(`${d.declaredDate}T00:00:00Z`),
      counties: d.counties || null,
      notes: d.notes || null,
      isActive: d.isActive,
    };
    const row = id
      ? await prisma.emergencyDeclaration.update({ where: { id }, data })
      : await prisma.emergencyDeclaration.create({ data });

    if (id) {
      const linked = await prisma.claim.findMany({
        where: { emergencyDeclarationId: id },
        select: { id: true, claimReportedDate: true, isReopenedClaim: true },
      });
      for (const c of linked) {
        const cap = computeFeeCap({
          isEmergencyLoss: true,
          emergencyDeclaredDate: row.declaredDate,
          claimReportedDate: c.claimReportedDate,
          isReopenedClaim: c.isReopenedClaim,
        });
        await prisma.claim.update({
          where: { id: c.id },
          data: {
            isCatClaim: cap.emergencyCapApplies,
            contingencyFeePercent: new Prisma.Decimal(cap.capPercent),
          },
        });
      }
    }
    revalidatePath("/admin/emergencies");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return { ok: false, error: "Only an admin can manage emergency declarations." };
    }
    console.error(e);
    return { ok: false, error: "Unable to save the declaration." };
  }
}
