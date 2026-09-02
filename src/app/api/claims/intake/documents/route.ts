import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeClaimDocument } from "@/lib/storage";
import { logClaimAudit } from "@/lib/claims/audit";
import { systemActor } from "@/lib/claims/system-actor";
import { blackgateServiceAuthorized } from "@/lib/integrations/service-auth";
import { resolveBlackgateFileUrl } from "@/lib/integrations/blackgate";
import { docTypeEnum } from "@/lib/schemas/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  claimId: z.string().min(1),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  docType: docTypeEnum.optional(),
  source: z.literal("BLACKGATE").optional(),
});

async function fetchRemoteBytes(fileUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Carry a BLACKGATE intake document onto the promoted claim vault.
 */
export async function POST(req: NextRequest) {
  if (!blackgateServiceAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid document payload." },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const claim = await prisma.claim.findUnique({
    where: { id: input.claimId },
    select: { id: true, isArchived: true, claimNumber: true },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }
  if (claim.isArchived) {
    return NextResponse.json({ error: "Archived files are sealed." }, { status: 400 });
  }

  const existing = await prisma.document.findFirst({
    where: {
      claimId: claim.id,
      extractedData: {
        path: ["sourceFileUrl"],
        equals: input.fileUrl,
      },
    },
    select: { id: true, fileUrl: true },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      id: existing.id,
      fileUrl: existing.fileUrl,
      reused: true,
    });
  }

  const actor = await systemActor();
  if (!actor) {
    return NextResponse.json(
      { error: "No active adjuster to file the vault copy." },
      { status: 500 }
    );
  }

  const remoteUrl = resolveBlackgateFileUrl(input.fileUrl);
  const bytes = await fetchRemoteBytes(remoteUrl);
  let fileUrl = remoteUrl;
  let storedSize = input.fileSizeBytes ?? 0;

  if (bytes) {
    const stored = await storeClaimDocument({
      claimId: claim.id,
      fileName: input.fileName,
      bytes,
      mimeType: input.mimeType || "application/octet-stream",
    });
    fileUrl = stored.fileUrl;
    storedSize = bytes.length;
  }

  const doc = await prisma.document.create({
    data: {
      claimId: claim.id,
      fileName: input.fileName,
      fileUrl,
      fileSizeBytes: storedSize,
      mimeType: input.mimeType || "application/octet-stream",
      docType: input.docType ?? "OTHER",
      uploadedById: actor.id,
      extractionStatus: "NOT_APPLICABLE",
      extractedData: {
        source: "BLACKGATE",
        sourceFileUrl: input.fileUrl,
      },
    },
  });

  await logClaimAudit({
    claimId: claim.id,
    actorId: actor.id,
    action: "DOCUMENT_UPLOAD",
    entityType: "Document",
    entityId: doc.id,
    summary: `Carried BLACKGATE document “${input.fileName}” onto ${claim.claimNumber}`,
    meta: { source: "BLACKGATE", sourceFileUrl: input.fileUrl },
  });

  revalidatePath(`/claims/${claim.id}`);
  revalidatePath(`/claims/${claim.id}/documents`);

  return NextResponse.json({ ok: true, id: doc.id, fileUrl: doc.fileUrl });
}
