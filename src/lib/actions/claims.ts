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
  coverageUpdateSchema,
  paymentCreateSchema,
  claimantSchema,
  type FnolIntakeInput,
  type StatusChangeInput,
  type ClaimDetailUpdateInput,
} from "@/lib/schemas/claim";
import {
  isPolicyExtractionResult,
  type PolicyExtractionResult,
} from "@/lib/policy-extraction";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toDecimal(
  value: string | number | null | undefined
): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

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
    const estimatedValue = toDecimal(
      d.estimatedValue as string | number | null | undefined
    );

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
        insurerClaimNumber: d.insurerClaimNumber || null,
        deskExaminerName: d.deskExaminerName || null,
        deskExaminerPhone: d.deskExaminerPhone || null,
        deskExaminerEmail: d.deskExaminerEmail || null,
        fieldAdjusterName: d.fieldAdjusterName || null,
        fieldAdjusterPhone: d.fieldAdjusterPhone || null,
        fieldAdjusterEmail: d.fieldAdjusterEmail || null,
        experts:
          d.experts && d.experts.length > 0
            ? d.experts.filter((e) => e.name.trim())
            : Prisma.JsonNull,
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
    // For certified POLICY copies, mark PENDING so Parse Policy can run.
    const extractionStatus =
      input.docType === "POLICY" ? "PENDING" : "NOT_APPLICABLE";

    const doc = await prisma.document.create({
      data: {
        claimId: input.claimId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        docType: input.docType as never,
        uploadedById: session.user.id,
        extractionStatus,
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

export async function updateCoverageAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to edit." };
    }

    const parsed = coverageUpdateSchema.safeParse(raw);
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
        coverageALimit: toDecimal(d.coverageALimit),
        coverageBLimit: toDecimal(d.coverageBLimit),
        coverageCLimit: toDecimal(d.coverageCLimit),
        coverageDLimit: toDecimal(d.coverageDLimit),
        policyExclusions: d.policyExclusions || null,
        policyEndorsements: d.policyEndorsements || null,
        coverageAnalysis: d.coverageAnalysis || null,
        policyNumber: d.policyNumber || null,
        carrierName: d.carrierName || null,
      },
    });

    revalidatePath(`/claims/${claimId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Coverage update failed." };
  }
}

/**
 * Parse a certified POLICY document and populate Coverage A–D / exclusions /
 * endorsements on the claim.
 *
 * AI_HOOK: call extraction service with Document.fileUrl, write results to
 * Document.extractedData, set extractionStatus COMPLETE|FAILED, then apply
 * via applyPolicyExtractionToClaim().
 */
export async function parsePolicyDocumentAction(
  claimId: string,
  documentId?: string
): Promise<ActionResult<{ applied: boolean; message: string }>> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to parse policy." };
    }

    const doc = documentId
      ? await prisma.document.findFirst({
          where: { id: documentId, claimId, docType: "POLICY" },
        })
      : await prisma.document.findFirst({
          where: { claimId, docType: "POLICY" },
          orderBy: { uploadedAt: "desc" },
        });

    if (!doc) {
      return {
        ok: false,
        error:
          "No certified policy on file. Upload a POLICY document first, then parse.",
      };
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { extractionStatus: "PENDING" },
    });

    // AI_HOOK: after upload / on parse, call extraction service and
    // populate Document.extractedData + set extractionStatus
    // Expected extractedData shape: PolicyExtractionResult
    // (coverageALimit–D, policyExclusions, policyEndorsements, policyNumber, carrierName)
    //
    // const extracted = await extractionService.parsePolicy(doc.fileUrl)
    // await prisma.document.update({ where: { id: doc.id }, data: {
    //   extractedData: extracted, extractionStatus: 'COMPLETE'
    // }})
    // await applyPolicyExtractionToClaim(claimId, extracted)

    // If extractedData was already populated (e.g. by a prior pipeline run), apply it.
    if (isPolicyExtractionResult(doc.extractedData)) {
      await applyPolicyExtractionToClaim(claimId, doc.extractedData);
      await prisma.document.update({
        where: { id: doc.id },
        data: { extractionStatus: "COMPLETE" },
      });
      revalidatePath(`/claims/${claimId}`);
      revalidatePath(`/claims/${claimId}/documents`);
      return {
        ok: true,
        data: {
          applied: true,
          message: "Coverage fields populated from existing extraction payload.",
        },
      };
    }

    revalidatePath(`/claims/${claimId}`);
    revalidatePath(`/claims/${claimId}/documents`);
    return {
      ok: true,
      data: {
        applied: false,
        message:
          "Policy queued for extraction (PENDING). AI_HOOK not connected this phase — enter Coverage A–D manually or wire the extraction service.",
      },
    };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Policy parse failed." };
  }
}

/** Apply a PolicyExtractionResult onto Claim coverage / policy fields. */
export async function applyPolicyExtractionToClaim(
  claimId: string,
  extracted: PolicyExtractionResult
): Promise<void> {
  await prisma.claim.update({
    where: { id: claimId },
    data: {
      policyNumber: extracted.policyNumber || undefined,
      carrierName: extracted.carrierName || undefined,
      coverageALimit: toDecimal(extracted.coverageALimit),
      coverageBLimit: toDecimal(extracted.coverageBLimit),
      coverageCLimit: toDecimal(extracted.coverageCLimit),
      coverageDLimit: toDecimal(extracted.coverageDLimit),
      policyExclusions: extracted.policyExclusions || undefined,
      policyEndorsements: extracted.policyEndorsements || undefined,
      coverageAnalysis: extracted.coverageAnalysis || undefined,
      policyParsedAt: new Date(),
    },
  });
}
