"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type PolicyLine } from "@prisma/client";
import { z } from "zod";
import { requireSession, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isPolicyExtractionResult,
  limitsToLegacyHo,
  normalizeExtractionLimits,
  coercePolicyLine,
  type PolicyLimitRow,
} from "@/lib/policy-extraction";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const limitRowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  amount: z.union([z.number(), z.null()]).optional(),
  notes: z.string().optional().nullable(),
});

const claimPolicyUpdateSchema = z.object({
  id: z.string().min(1),
  line: z.string().min(1),
  label: z.string().optional().nullable(),
  policyNumber: z.string().optional().nullable(),
  carrierName: z.string().optional().nullable(),
  namedInsured: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  limits: z.array(limitRowSchema).optional().default([]),
  deductibleNotes: z.string().optional().nullable(),
  exclusions: z.string().optional().nullable(),
  endorsements: z.string().optional().nullable(),
  analysis: z.string().optional().nullable(),
  premium: z.union([z.string(), z.number(), z.null()]).optional(),
  isPrimary: z.boolean().optional(),
});

function toDecimal(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  return new Date(value);
}

function revalidateClaim(claimId: string) {
  revalidatePath(`/claims/${claimId}`);
  revalidatePath(`/claims/${claimId}/documents`);
}

export async function parsePolicyDocumentAction(
  claimId: string,
  documentId?: string,
  hintLine?: PolicyLine | null
): Promise<ActionResult<{ applied: boolean; message: string; policyId?: string }>> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges to parse policy." };
    }

    let doc = documentId
      ? await prisma.document.findFirst({
          where: { id: documentId, claimId },
        })
      : await prisma.document.findFirst({
          where: { claimId, docType: "POLICY" },
          orderBy: { uploadedAt: "desc" },
        });

    if (!doc) {
      return {
        ok: false,
        error:
          "No document found to parse. Upload a policy PDF in the vault, then parse.",
      };
    }

    // Vault uploads may not be typed as POLICY yet — promote so Coverage Protocol picks them up
    if (doc.docType !== "POLICY") {
      doc = await prisma.document.update({
        where: { id: doc.id },
        data: {
          docType: "POLICY",
          extractionStatus: "PENDING",
          policyLine: hintLine ?? doc.policyLine,
        },
      });
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { extractionStatus: "PENDING" },
    });

    const lineHint = hintLine ?? doc.policyLine ?? null;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { extractPolicyFromDocument } = await import("@/lib/policy-ai");
        const extracted = await extractPolicyFromDocument({
          fileUrl: doc.fileUrl,
          mimeType: doc.mimeType,
          fileName: doc.fileName,
          hintLine: lineHint,
        });

        await prisma.document.update({
          where: { id: doc.id },
          data: {
            extractedData: extracted,
            extractionStatus: "COMPLETE",
            policyLine: coercePolicyLine(extracted.policyLine, lineHint ?? "OTHER"),
          },
        });

        const policyId = await upsertClaimPolicyFromExtraction(
          claimId,
          doc.id,
          extracted
        );

        revalidateClaim(claimId);
        return {
          ok: true,
          data: {
            applied: true,
            policyId,
            message: `Policy parsed as ${coercePolicyLine(extracted.policyLine)} — limits saved to Coverage Protocol.`,
          },
        };
      } catch (extractErr) {
        console.error(extractErr);
        const message =
          extractErr instanceof Error
            ? extractErr.message
            : "Policy extraction failed.";
        await prisma.document.update({
          where: { id: doc.id },
          data: { extractionStatus: "FAILED" },
        });
        revalidateClaim(claimId);
        return { ok: false, error: message };
      }
    }

    if (isPolicyExtractionResult(doc.extractedData)) {
      const policyId = await upsertClaimPolicyFromExtraction(
        claimId,
        doc.id,
        doc.extractedData
      );
      await prisma.document.update({
        where: { id: doc.id },
        data: { extractionStatus: "COMPLETE" },
      });
      revalidateClaim(claimId);
      return {
        ok: true,
        data: {
          applied: true,
          policyId,
          message: "Coverage fields populated from existing extraction payload.",
        },
      };
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { extractionStatus: "FAILED" },
    });
    revalidateClaim(claimId);
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY is not configured. Set it in .env / Vercel to enable Parse Policy, or enter coverage manually.",
    };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Policy parse failed." };
  }
}

async function upsertClaimPolicyFromExtraction(
  claimId: string,
  documentId: string,
  extracted: import("@/lib/policy-extraction").PolicyExtractionResult
): Promise<string> {
  const line = coercePolicyLine(extracted.policyLine);
  const limits = normalizeExtractionLimits(extracted);

  const existing = await prisma.claimPolicy.findFirst({
    where: { claimId, documentId },
  });

  const data = {
    line,
    label:
      extracted.label ||
      (line === "OTHER" ? "Policy" : line.replace(/_/g, " ")),
    policyNumber: extracted.policyNumber || null,
    carrierName: extracted.carrierName || null,
    namedInsured: extracted.namedInsured || null,
    effectiveDate: parseDate(extracted.effectiveDate),
    expirationDate: parseDate(extracted.expirationDate),
    limits: limits as unknown as Prisma.InputJsonValue,
    deductibleNotes: extracted.deductibleNotes || null,
    exclusions: extracted.policyExclusions || null,
    endorsements: extracted.policyEndorsements || null,
    analysis: extracted.coverageAnalysis || null,
    premium: toDecimal(extracted.premium),
    documentId,
    parsedAt: new Date(),
  };

  let policyId: string;
  if (existing) {
    await prisma.claimPolicy.update({ where: { id: existing.id }, data });
    policyId = existing.id;
  } else {
    const created = await prisma.claimPolicy.create({
      data: { claimId, ...data },
    });
    policyId = created.id;
  }

  // Keep legacy Claim.policyNumber/carrier + HO A–D in sync when useful
  const legacy = limitsToLegacyHo(limits);
  await prisma.claim.update({
    where: { id: claimId },
    data: {
      policyNumber: extracted.policyNumber || undefined,
      carrierName: extracted.carrierName || undefined,
      policyExclusions: extracted.policyExclusions || undefined,
      policyEndorsements: extracted.policyEndorsements || undefined,
      coverageAnalysis: extracted.coverageAnalysis || undefined,
      policyParsedAt: new Date(),
      ...(line === "HOMEOWNERS"
        ? {
            coverageALimit: toDecimal(legacy.coverageALimit),
            coverageBLimit: toDecimal(legacy.coverageBLimit),
            coverageCLimit: toDecimal(legacy.coverageCLimit),
            coverageDLimit: toDecimal(legacy.coverageDLimit),
          }
        : {}),
    },
  });

  return policyId;
}

export async function updateClaimPolicyAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges." };
    }

    const parsed = claimPolicyUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const d = parsed.data;
    const existing = await prisma.claimPolicy.findFirst({
      where: { id: d.id, claimId },
    });
    if (!existing) return { ok: false, error: "Policy record not found." };

    const limits: PolicyLimitRow[] = (d.limits ?? []).map((row) => ({
      key: row.key,
      label: row.label,
      amount:
        typeof row.amount === "number" && Number.isFinite(row.amount)
          ? row.amount
          : null,
      notes: row.notes ?? null,
    }));

    if (d.isPrimary) {
      await prisma.claimPolicy.updateMany({
        where: { claimId },
        data: { isPrimary: false },
      });
    }

    await prisma.claimPolicy.update({
      where: { id: d.id },
      data: {
        line: coercePolicyLine(d.line),
        label: d.label || null,
        policyNumber: d.policyNumber || null,
        carrierName: d.carrierName || null,
        namedInsured: d.namedInsured || null,
        effectiveDate: parseDate(d.effectiveDate),
        expirationDate: parseDate(d.expirationDate),
        limits: limits as unknown as Prisma.InputJsonValue,
        deductibleNotes: d.deductibleNotes || null,
        exclusions: d.exclusions || null,
        endorsements: d.endorsements || null,
        analysis: d.analysis || null,
        premium: toDecimal(d.premium),
        isPrimary: d.isPrimary ?? existing.isPrimary,
      },
    });

    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to update policy record." };
  }
}

export async function deleteClaimPolicyAction(
  claimId: string,
  policyId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges." };
    }

    const existing = await prisma.claimPolicy.findFirst({
      where: { id: policyId, claimId },
    });
    if (!existing) return { ok: false, error: "Policy record not found." };

    await prisma.claimPolicy.delete({ where: { id: policyId } });
    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to delete policy record." };
  }
}

export async function createManualClaimPolicyAction(
  claimId: string,
  line: PolicyLine
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges." };
    }

    const {
      POLICY_LINE_LIMIT_TEMPLATES,
    } = await import("@/lib/policy-extraction");
    const template = POLICY_LINE_LIMIT_TEMPLATES[line] ?? [];
    const limits = template.map((t) => ({
      key: t.key,
      label: t.label,
      amount: null,
      notes: null,
    }));

    const created = await prisma.claimPolicy.create({
      data: {
        claimId,
        line,
        label: line.replace(/_/g, " "),
        limits,
      },
    });

    revalidateClaim(claimId);
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to add policy record." };
  }
}
