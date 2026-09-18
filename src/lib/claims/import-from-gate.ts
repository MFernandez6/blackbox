import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  findClaimByIntakeId,
  openClaimFromIntake,
} from "@/lib/claims/open-from-intake";
import { fnolIntakeSchema, lossTypeEnum } from "@/lib/schemas/claim";
import { systemActor } from "@/lib/claims/system-actor";
import { storeClaimDocument } from "@/lib/storage";
import { logClaimAudit } from "@/lib/claims/audit";
import { resolveBlackgateFileUrl } from "@/lib/integrations/blackgate";

type GateIntakeRow = {
  id: string;
  intakeNumber: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContactMethod: string;
  mailingAddress: string | null;
  propertyAddress: string | null;
  accidentLocation: string | null;
  zipCode: string | null;
  county: string | null;
  lossType: string | null;
  dateOfLoss: Date | null;
  submittedAt: Date;
  lossDescription: string | null;
  policyNumber: string | null;
  carrierName: string | null;
  insurerClaimNumber: string | null;
};

type GateHandoffRow = {
  id: string;
  status: string;
  blackboxClaimId: string | null;
  blackboxClaimNumber: string | null;
  payloadJson: string | null;
  createdAt: Date;
};

type GateDocumentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  carriedToClaim: boolean;
};

function normalizeZip(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "00000";
}

function mapLossType(value: string | null | undefined) {
  const parsed = lossTypeEnum.safeParse(value);
  return parsed.success ? parsed.data : "OTHER";
}

function handoffLooksDry(handoff: GateHandoffRow | null): boolean {
  if (!handoff) return false;
  if (handoff.blackboxClaimId?.startsWith("dry-")) return true;
  if (!handoff.payloadJson) return false;
  try {
    const payload = JSON.parse(handoff.payloadJson) as { dryRun?: boolean };
    return payload.dryRun === true;
  } catch {
    return false;
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function readGateIntake(intakeNumber: string): Promise<GateIntakeRow | null> {
  const rows = await prisma.$queryRaw<GateIntakeRow[]>`
    SELECT
      id, "intakeNumber", status, "firstName", "lastName", email, phone,
      "preferredContactMethod", "mailingAddress", "propertyAddress",
      "accidentLocation", "zipCode", county, "lossType", "dateOfLoss",
      "submittedAt", "lossDescription", "policyNumber", "carrierName",
      "insurerClaimNumber"
    FROM blackgate."Intake"
    WHERE "intakeNumber" = ${intakeNumber}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function readLatestHandoff(intakeId: string): Promise<GateHandoffRow | null> {
  const rows = await prisma.$queryRaw<GateHandoffRow[]>`
    SELECT id, status, "blackboxClaimId", "blackboxClaimNumber", "payloadJson", "createdAt"
    FROM blackgate."HandoffLog"
    WHERE "intakeId" = ${intakeId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function listBrokenPromotedIntakes(): Promise<Array<{ intakeNumber: string }>> {
  return prisma.$queryRaw<Array<{ intakeNumber: string }>>`
    SELECT i."intakeNumber"
    FROM blackgate."Intake" i
    WHERE i.status = 'PROMOTED'
      AND NOT EXISTS (
        SELECT 1 FROM "Claim" c
        WHERE c."sourceIntakeId" = i.id
      )
    ORDER BY i."submittedAt" DESC
  `;
}

async function listGateDocuments(intakeId: string): Promise<GateDocumentRow[]> {
  return prisma.$queryRaw<GateDocumentRow[]>`
    SELECT id, "fileName", "fileUrl", "mimeType", "fileSizeBytes", "carriedToClaim"
    FROM blackgate."IntakeDocument"
    WHERE "intakeId" = ${intakeId}
    ORDER BY "uploadedAt" ASC
  `;
}

async function markHandoffLive(opts: {
  intakeId: string;
  handoffId: string | null;
  claimId: string;
  claimNumber: string;
  actorStaffId: string | null;
  priorPayload: string | null;
}) {
  const payload = {
    ...safeJson(opts.priorPayload ?? "{}"),
    dryRun: false,
    repairedFromDryRun: true,
    repairedAt: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify(payload);

  if (opts.handoffId) {
    await prisma.$executeRaw`
      UPDATE blackgate."HandoffLog"
      SET
        status = 'SUCCEEDED',
        "blackboxClaimId" = ${opts.claimId},
        "blackboxClaimNumber" = ${opts.claimNumber},
        "payloadJson" = ${payloadJson},
        "errorMessage" = NULL
      WHERE id = ${opts.handoffId}
    `;
    return;
  }

  const handoffId = `repair_${opts.claimId}`;
  await prisma.$executeRaw`
    INSERT INTO blackgate."HandoffLog" (
      id, "intakeId", status, "blackboxClaimId", "blackboxClaimNumber",
      "fieldTasksCreated", "ledgerTagged", "payloadJson", "performedById", "createdAt"
    ) VALUES (
      ${handoffId},
      ${opts.intakeId},
      'SUCCEEDED',
      ${opts.claimId},
      ${opts.claimNumber},
      0,
      false,
      ${payloadJson},
      ${opts.actorStaffId},
      NOW()
    )
  `;
}

async function carryDocuments(opts: {
  claimId: string;
  claimNumber: string;
  actorId: string;
  docs: GateDocumentRow[];
}) {
  let carried = 0;
  for (const doc of opts.docs) {
    const absoluteUrl = resolveBlackgateFileUrl(doc.fileUrl);

    const already = await prisma.document.findFirst({
      where: {
        claimId: opts.claimId,
        extractedData: {
          path: ["sourceFileUrl"],
          equals: doc.fileUrl,
        },
      },
      select: { id: true },
    });
    if (already) continue;

    let bytes: Buffer | null = null;
    try {
      const res = await fetch(absoluteUrl);
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
    } catch {
      bytes = null;
    }

    let fileUrl = absoluteUrl;
    let size = doc.fileSizeBytes;
    if (bytes) {
      const stored = await storeClaimDocument({
        claimId: opts.claimId,
        fileName: doc.fileName,
        bytes,
        mimeType: doc.mimeType || "application/octet-stream",
      });
      fileUrl = stored.fileUrl;
      size = bytes.length;
    }

    const created = await prisma.document.create({
      data: {
        claimId: opts.claimId,
        fileName: doc.fileName,
        fileUrl,
        fileSizeBytes: size,
        mimeType: doc.mimeType || "application/octet-stream",
        docType: "OTHER",
        uploadedById: opts.actorId,
        extractionStatus: "NOT_APPLICABLE",
        extractedData: {
          source: "BLACKGATE",
          sourceFileUrl: doc.fileUrl,
        } as Prisma.InputJsonValue,
      },
    });

    await prisma.$executeRaw`
      UPDATE blackgate."IntakeDocument"
      SET "carriedToClaim" = true
      WHERE id = ${doc.id}
    `;

    await logClaimAudit({
      claimId: opts.claimId,
      actorId: opts.actorId,
      action: "DOCUMENT_UPLOAD",
      entityType: "Document",
      entityId: created.id,
      summary: `Repaired BLACKGATE document “${doc.fileName}” onto ${opts.claimNumber}`,
      meta: { source: "BLACKGATE", sourceFileUrl: doc.fileUrl },
    });
    carried += 1;
  }
  return carried;
}

export type GateImportResult = {
  intakeNumber: string;
  claimId: string;
  claimNumber: string;
  reused: boolean;
  documentsCarried: number;
  wasDryRun: boolean;
};

/**
 * Opens (or reuses) the BLACKBOX claim for a BLACKGATE intake that was
 * marked PROMOTED without a real claim — typically a dry-run handoff.
 */
export async function importGateIntakeByNumber(
  intakeNumber: string
): Promise<GateImportResult> {
  const intake = await readGateIntake(intakeNumber.trim());
  if (!intake) {
    throw new Error(
      `BLACKGATE intake ${intakeNumber} not found in shared database.`
    );
  }

  const existing = await findClaimByIntakeId(intake.id);
  const handoff = await readLatestHandoff(intake.id);
  const wasDryRun = handoffLooksDry(handoff);

  if (existing && !wasDryRun) {
    return {
      intakeNumber: intake.intakeNumber,
      claimId: existing.id,
      claimNumber: existing.claimNumber,
      reused: true,
      documentsCarried: 0,
      wasDryRun: false,
    };
  }

  const actor = await systemActor();
  if (!actor) {
    throw new Error("No active adjuster to own the imported file.");
  }

  const actorFull = await prisma.adjuster.findUnique({
    where: { id: actor.id },
    select: { id: true, email: true },
  });

  let claim = existing;
  if (!claim) {
    const propertyAddress =
      intake.propertyAddress?.trim() ||
      intake.accidentLocation?.trim() ||
      "See BLACKGATE intake";
    const contact =
      intake.preferredContactMethod === "EMAIL" ||
      intake.preferredContactMethod === "PHONE" ||
      intake.preferredContactMethod === "TEXT"
        ? intake.preferredContactMethod
        : "EMAIL";

    const coerced = {
      claimants: [
        {
          firstName: intake.firstName,
          lastName: intake.lastName,
          email: intake.email?.trim() || "intake@blacklineadjusting.com",
          phone: intake.phone?.trim() || "0000000000",
          mailingAddress: intake.mailingAddress?.trim() || propertyAddress,
          preferredContactMethod: contact as "EMAIL" | "PHONE" | "TEXT",
          isPrimaryContact: true,
        },
      ],
      property: {
        propertyAddress,
        zipCode: normalizeZip(intake.zipCode),
        county: intake.county?.trim() || "Unknown",
        lossType: mapLossType(intake.lossType),
        dateOfLoss: (intake.dateOfLoss ?? intake.submittedAt)
          .toISOString()
          .slice(0, 10),
        lossDescription:
          intake.lossDescription?.trim() || "See BLACKGATE intake file.",
        isCatClaim: intake.lossType === "WIND",
      },
      policy: {
        policyNumber: intake.policyNumber,
        carrierName: intake.carrierName,
        insurerClaimNumber: intake.insurerClaimNumber,
      },
    };

    const parsed = fnolIntakeSchema.safeParse(coerced);
    if (!parsed.success) {
      throw new Error(
        parsed.error.errors[0]?.message ?? "Intake failed validation."
      );
    }

    claim = await openClaimFromIntake({
      parsed: parsed.data,
      actorId: actor.id,
      source: {
        product: "BLACKGATE",
        intakeId: intake.id,
        intakeNumber: intake.intakeNumber,
      },
      statusNote: `Record repaired from BLACKGATE intake ${intake.intakeNumber} after a dry-run / failed handoff.`,
    });
  }

  const docs = await listGateDocuments(intake.id);
  const documentsCarried = await carryDocuments({
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    actorId: actor.id,
    docs,
  });

  const staff = actorFull?.email
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM blackgate."Staff"
        WHERE lower(email) = lower(${actorFull.email})
        LIMIT 1
      `.catch(() => [] as Array<{ id: string }>)
    : [];

  await markHandoffLive({
    intakeId: intake.id,
    handoffId: handoff?.id ?? null,
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    actorStaffId: staff[0]?.id ?? null,
    priorPayload: handoff?.payloadJson ?? null,
  });

  await prisma.$executeRaw`
    UPDATE blackgate."Intake"
    SET status = 'PROMOTED'
    WHERE id = ${intake.id}
  `;

  return {
    intakeNumber: intake.intakeNumber,
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    reused: Boolean(existing),
    documentsCarried,
    wasDryRun,
  };
}

export async function repairMissingGateHandoffs(): Promise<GateImportResult[]> {
  const missing = await listBrokenPromotedIntakes();
  const results: GateImportResult[] = [];
  for (const row of missing) {
    results.push(await importGateIntakeByNumber(row.intakeNumber));
  }
  return results;
}
