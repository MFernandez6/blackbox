"use server";

import { revalidatePath } from "next/cache";
import { ClaimStatus, Prisma } from "@prisma/client";
import { requireSession, canEdit, canManagePayments } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allocateClaimNumber } from "@/lib/claims/claim-number";
import { contingencyForCat } from "@/lib/utils";
import {
  fnolIntakeSchema,
  statusChangeSchema,
  claimDetailUpdateSchema,
  paymentCreateSchema,
  claimantSchema,
  type FnolIntakeInput,
  type StatusChangeInput,
  type ClaimDetailUpdateInput,
} from "@/lib/schemas/claim";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createClaimAction(
  raw: FnolIntakeInput
): Promise<ActionResult<{ id: string; claimNumber: string }>> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to open a record." };
    }

    const parsed = fnolIntakeSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const { claimants, property, policy, contingencyFeePercent } = parsed.data;

    const claim = await prisma.$transaction(async (tx) => {
      const claimNumber = await allocateClaimNumber(tx);
      const created = await tx.claim.create({
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
          estimatedValue:
            policy.estimatedValue !== null && policy.estimatedValue !== undefined
              ? new Prisma.Decimal(policy.estimatedValue)
              : null,
          assignedAdjusterId: session.user.id,
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
              changedById: session.user.id,
              note: "Record opened. File integrity: sealed at intake.",
            },
          },
        },
      });
      return created;
    });

    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { id: claim.id, claimNumber: claim.claimNumber },
    };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to open record. Retry or contact admin." };
  }
}

export async function changeClaimStatusAction(
  claimId: string,
  raw: StatusChangeInput
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to alter status." };
    }

    const parsed = statusChangeSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({ where: { id: claimId } });
      if (!claim) throw new Error("NOT_FOUND");
      if (claim.isArchived) throw new Error("ARCHIVED");

      await tx.claim.update({
        where: { id: claimId },
        data: { status: parsed.data.newStatus },
      });

      await tx.statusHistory.create({
        data: {
          claimId,
          previousStatus: claim.status,
          newStatus: parsed.data.newStatus,
          changedById: session.user.id,
          note: parsed.data.note,
        },
      });
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Status change failed. Record unchanged." };
  }
}

export async function archiveClaimAction(
  claimId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to archive." };
    }

    await prisma.claim.update({
      where: { id: claimId },
      data: { isArchived: true },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/claims/${claimId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Archive failed." };
  }
}

export async function updateClaimDetailAction(
  claimId: string,
  raw: ClaimDetailUpdateInput
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to edit." };
    }

    const parsed = claimDetailUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const d = parsed.data;
    const fee = contingencyForCat(d.isCatClaim);

    let estimatedValue: Prisma.Decimal | null = null;
    if (d.estimatedValue !== null && d.estimatedValue !== undefined && d.estimatedValue !== "") {
      const n =
        typeof d.estimatedValue === "string"
          ? Number(d.estimatedValue.replace(/,/g, ""))
          : d.estimatedValue;
      if (!Number.isNaN(n)) estimatedValue = new Prisma.Decimal(n);
    }

    await prisma.claim.update({
      where: { id: claimId },
      data: {
        propertyAddress: d.propertyAddress,
        zipCode: d.zipCode.slice(0, 5),
        county: d.county,
        lossType: d.lossType,
        dateOfLoss: new Date(d.dateOfLoss),
        lossDescription: d.lossDescription ?? null,
        policyNumber: d.policyNumber || null,
        carrierName: d.carrierName || null,
        estimatedValue,
        isCatClaim: d.isCatClaim,
        contingencyFeePercent: fee,
        assignedAdjusterId: d.assignedAdjusterId || null,
      },
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Update failed." };
  }
}

export async function updateClaimantsAction(
  claimId: string,
  claimants: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to edit." };
    }

    const listSchema = claimantSchema
      .array()
      .min(1)
      .refine(
        (list) => list.filter((c) => c.isPrimaryContact).length === 1,
        "Designate exactly one primary contact"
      );

    const parsed = listSchema.safeParse(claimants);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.claimant.deleteMany({ where: { claimId } });
      await tx.claimant.createMany({
        data: parsed.data.map((c) => ({
          claimId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          mailingAddress: c.mailingAddress,
          preferredContactMethod: c.preferredContactMethod,
          isPrimaryContact: c.isPrimaryContact,
        })),
      });
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Claimant update failed." };
  }
}

export async function createPaymentAction(
  raw: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canManagePayments(session.user.role)) {
      return { ok: false, error: "Payment log is ADMIN-only." };
    }

    const parsed = paymentCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    await prisma.payment.create({
      data: {
        claimId: parsed.data.claimId,
        type: parsed.data.type,
        amount: new Prisma.Decimal(parsed.data.amount),
        date: new Date(parsed.data.date),
        note: parsed.data.note || null,
        recordedById: session.user.id,
      },
    });

    revalidatePath(`/claims/${parsed.data.claimId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Payment record failed." };
  }
}

export async function registerDocumentAction(input: {
  claimId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  docType: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to upload." };
    }

    // AI_HOOK: after upload, call extraction service and
    // populate Document.extractedData + set extractionStatus

    const doc = await prisma.document.create({
      data: {
        claimId: input.claimId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        docType: input.docType as never,
        uploadedById: session.user.id,
        extractionStatus: "NOT_APPLICABLE",
      },
    });

    revalidatePath(`/claims/${input.claimId}`);
    revalidatePath(`/claims/${input.claimId}/documents`);
    return { ok: true, data: { id: doc.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Document registration failed." };
  }
}
