import { ClaimStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateClaimNumber } from "@/lib/claims/claim-number";
import type { FnolIntakeParsed } from "@/lib/schemas/claim";

export type ClaimSourceOrigin = {
  product: "BLACKGATE";
  intakeId: string;
  intakeNumber: string;
};

export async function findClaimByIntakeId(intakeId: string) {
  return prisma.claim.findUnique({
    where: { sourceIntakeId: intakeId },
    select: { id: true, claimNumber: true },
  });
}

export async function openClaimFromIntake(opts: {
  parsed: FnolIntakeParsed;
  actorId: string;
  source?: ClaimSourceOrigin | null;
  statusNote?: string;
}): Promise<{ id: string; claimNumber: string }> {
  const { parsed, actorId, source } = opts;
  const { claimants, property, policy, contingencyFeePercent } = parsed;
  const statusNote =
    opts.statusNote ??
    (source
      ? `Record opened from ${source.product} intake ${source.intakeNumber}. File integrity: sealed at intake.`
      : "Record opened. File integrity: sealed at intake.");

  const claim = await prisma.$transaction(async (tx) => {
    const claimNumber = await allocateClaimNumber(tx);
    return tx.claim.create({
      data: {
        claimNumber,
        status: ClaimStatus.INTAKE,
        lossType: property.lossType,
        dateOfLoss: new Date(property.dateOfLoss),
        propertyAddress: property.propertyAddress,
        zipCode: property.zipCode.slice(0, 5),
        county: property.county,
        lossDescription: property.lossDescription,
        isCatClaim: property.isCatClaim,
        contingencyFeePercent,
        policyNumber: policy.policyNumber || null,
        carrierName: policy.carrierName || null,
        insurerClaimNumber: policy.insurerClaimNumber || null,
        deskExaminerName: policy.deskExaminerName || null,
        deskExaminerPhone: policy.deskExaminerPhone || null,
        deskExaminerEmail: policy.deskExaminerEmail || null,
        fieldAdjusterName: policy.fieldAdjusterName || null,
        fieldAdjusterPhone: policy.fieldAdjusterPhone || null,
        fieldAdjusterEmail: policy.fieldAdjusterEmail || null,
        experts:
          policy.experts && policy.experts.length > 0
            ? policy.experts.filter((e) => e.name.trim())
            : Prisma.JsonNull,
        estimatedValue:
          policy.estimatedValue !== null && policy.estimatedValue !== undefined
            ? new Prisma.Decimal(policy.estimatedValue)
            : null,
        assignedAdjusterId: actorId,
        sourceProduct: source?.product ?? null,
        sourceIntakeId: source?.intakeId ?? null,
        sourceIntakeNumber: source?.intakeNumber ?? null,
        claimants: {
          create: claimants.map((c) => ({
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
            mailingAddress: c.mailingAddress,
            preferredContactMethod: c.preferredContactMethod,
            isPrimaryContact: c.isPrimaryContact,
          })),
        },
        statusHistory: {
          create: {
            previousStatus: null,
            newStatus: ClaimStatus.INTAKE,
            changedById: actorId,
            note: statusNote,
          },
        },
      },
    });
  });

  return { id: claim.id, claimNumber: claim.claimNumber };
}
