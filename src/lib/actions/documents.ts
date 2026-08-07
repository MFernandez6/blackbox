"use server";

import { revalidatePath } from "next/cache";
import { ExtractionStatus, type DocType, type PolicyLine } from "@prisma/client";
import { z } from "zod";
import { assertCanEditClaim } from "@/lib/claims/access";
import { logClaimAudit } from "@/lib/claims/audit";
import { prisma } from "@/lib/prisma";
import { deleteStoredDocument, storeClaimDocument } from "@/lib/storage";
import { coercePolicyLine } from "@/lib/policy-extraction";
import { docTypeEnum } from "@/lib/schemas/claim";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateClaim(claimId: string) {
  revalidatePath(`/claims/${claimId}`);
  revalidatePath(`/claims/${claimId}/documents`);
}

const renameSchema = z.object({
  documentId: z.string().min(1),
  fileName: z.string().min(1).max(240),
});

const metaSchema = z.object({
  documentId: z.string().min(1),
  docType: docTypeEnum.optional(),
  isCertifiedPolicy: z.boolean().optional(),
  policyLine: z.string().optional().nullable(),
});

export async function renameDocumentAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const parsed = renameSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Invalid name.",
      };
    }

    const doc = await prisma.document.findFirst({
      where: { id: parsed.data.documentId, claimId },
    });
    if (!doc) return { ok: false, error: "Document not found." };

    const fileName = parsed.data.fileName.trim();
    await prisma.document.update({
      where: { id: doc.id },
      data: { fileName },
    });

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "DOCUMENT_RENAME",
      entityType: "Document",
      entityId: doc.id,
      summary: `Renamed document to “${fileName}”`,
      meta: { previousName: doc.fileName },
    });

    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to rename document." };
  }
}

export async function updateDocumentMetaAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const parsed = metaSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const doc = await prisma.document.findFirst({
      where: { id: parsed.data.documentId, claimId },
    });
    if (!doc) return { ok: false, error: "Document not found." };

    const nextType = (parsed.data.docType ?? doc.docType) as DocType;
    const certified =
      parsed.data.isCertifiedPolicy ?? doc.isCertifiedPolicy;

    if (certified) {
      await prisma.document.updateMany({
        where: { claimId, isCertifiedPolicy: true, NOT: { id: doc.id } },
        data: { isCertifiedPolicy: false },
      });
    }

    const policyLine: PolicyLine | null | undefined =
      parsed.data.policyLine === undefined
        ? undefined
        : parsed.data.policyLine
          ? coercePolicyLine(parsed.data.policyLine)
          : null;

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        docType: nextType,
        isCertifiedPolicy: certified,
        ...(policyLine !== undefined ? { policyLine } : {}),
        ...(nextType === "POLICY" &&
        doc.extractionStatus === ExtractionStatus.NOT_APPLICABLE
          ? { extractionStatus: ExtractionStatus.PENDING }
          : {}),
      },
    });

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "DOCUMENT_META",
      entityType: "Document",
      entityId: doc.id,
      summary: certified
        ? `Marked “${doc.fileName}” as certified policy`
        : `Updated document metadata for “${doc.fileName}”`,
      meta: {
        docType: nextType,
        isCertifiedPolicy: certified,
        policyLine: policyLine ?? null,
      },
    });

    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to update document." };
  }
}

export async function deleteDocumentAction(
  claimId: string,
  documentId: string
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, claimId },
      include: { claimPolicies: { select: { id: true } } },
    });
    if (!doc) return { ok: false, error: "Document not found." };

    if (doc.claimPolicies.length > 0) {
      await prisma.claimPolicy.updateMany({
        where: { documentId: doc.id },
        data: { documentId: null },
      });
    }

    await prisma.document.delete({ where: { id: doc.id } });
    await deleteStoredDocument(doc.fileUrl);

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "DOCUMENT_DELETE",
      entityType: "Document",
      entityId: doc.id,
      summary: `Deleted document “${doc.fileName}”`,
    });

    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to delete document." };
  }
}

export async function replaceDocumentFileAction(
  claimId: string,
  documentId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Select a replacement file." };
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, claimId },
    });
    if (!doc) return { ok: false, error: "Document not found." };

    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      return { ok: false, error: "File exceeds 20MB limit." };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeClaimDocument({
      claimId,
      fileName: file.name,
      bytes,
      mimeType: file.type || "application/octet-stream",
    });

    const oldUrl = doc.fileUrl;
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        fileName: file.name,
        fileUrl: stored.fileUrl,
        fileSizeBytes: bytes.length,
        mimeType: file.type || "application/octet-stream",
        extractionStatus:
          doc.docType === "POLICY"
            ? ExtractionStatus.PENDING
            : doc.extractionStatus,
      },
    });

    await deleteStoredDocument(oldUrl);

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "DOCUMENT_REPLACE",
      entityType: "Document",
      entityId: doc.id,
      summary: `Replaced file for “${file.name}”`,
    });

    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    const message =
      e instanceof Error ? e.message : "Unable to replace document.";
    return { ok: false, error: message };
  }
}
