import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_DELETE"
  | "DOCUMENT_RENAME"
  | "DOCUMENT_REPLACE"
  | "DOCUMENT_META"
  | "POLICY_PARSE"
  | "COVERAGE_UPDATE"
  | "POLICY_RECORD_UPDATE"
  | "POLICY_RECORD_DELETE"
  | "POLICY_RECORD_CREATE";

export async function logClaimAudit(opts: {
  claimId: string;
  actorId: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.claimAuditEvent.create({
      data: {
        claimId: opts.claimId,
        actorId: opts.actorId,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        summary: opts.summary,
        meta: opts.meta,
      },
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
