import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeClaimDocument } from "@/lib/storage";
import { logClaimAudit } from "@/lib/claims/audit";
import { docTypeEnum } from "@/lib/schemas/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  claimId: z.string().min(1),
  generatedDocumentId: z.string().min(1),
  title: z.string().min(1),
  fileName: z.string().min(1),
  html: z.string().min(1),
  fileUrl: z.string().url().optional().nullable(),
  mimeType: z.string().optional(),
  docType: docTypeEnum.optional(),
  documentType: z.string().optional(),
});

function authorized(req: NextRequest): boolean {
  const key = process.env.BLACKLETTER_API_KEY;
  if (!key) return false;
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : header;
  return token === key;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "letter.html";
}

async function systemUploader() {
  return (
    (await prisma.adjuster.findFirst({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.adjuster.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }))
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid letter payload." },
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
        path: ["generatedDocumentId"],
        equals: input.generatedDocumentId,
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

  const uploader = await systemUploader();
  if (!uploader) {
    return NextResponse.json(
      { error: "No active adjuster to file the vault copy." },
      { status: 500 }
    );
  }

  const fileName = safeFileName(input.fileName.endsWith(".html") ? input.fileName : `${input.fileName}.html`);
  const bytes = Buffer.from(input.html, "utf8");
  let fileUrl = input.fileUrl?.trim() || "";
  let storedSize = bytes.length;

  if (!fileUrl || !fileUrl.includes("docs.google.com")) {
    try {
      const stored = await storeClaimDocument({
        claimId: claim.id,
        fileName,
        bytes,
        mimeType: input.mimeType || "text/html; charset=utf-8",
      });
      fileUrl = stored.fileUrl;
      storedSize = bytes.length;
    } catch (error) {
      if (!fileUrl) {
        const detail = error instanceof Error ? error.message : "Storage failed.";
        return NextResponse.json({ error: detail }, { status: 500 });
      }
    }
  }

  const doc = await prisma.document.create({
    data: {
      claimId: claim.id,
      fileName,
      fileUrl,
      fileSizeBytes: storedSize,
      mimeType: input.mimeType || "text/html; charset=utf-8",
      docType: input.docType ?? "CORRESPONDENCE",
      uploadedById: uploader.id,
      extractionStatus: "NOT_APPLICABLE",
      extractedData: {
        source: "BLACKLETTER",
        generatedDocumentId: input.generatedDocumentId,
        documentType: input.documentType ?? null,
        title: input.title,
        googleDocUrl: input.fileUrl ?? null,
      },
    },
  });

  await logClaimAudit({
    claimId: claim.id,
    actorId: uploader.id,
    action: "DOCUMENT_UPLOAD",
    entityType: "Document",
    entityId: doc.id,
    summary: `Filed executed BLACKLETTER “${input.title}” on ${claim.claimNumber}`,
    meta: {
      source: "BLACKLETTER",
      generatedDocumentId: input.generatedDocumentId,
    },
  });

  revalidatePath(`/claims/${claim.id}`);
  revalidatePath(`/claims/${claim.id}/documents`);

  return NextResponse.json({ ok: true, id: doc.id, fileUrl: doc.fileUrl });
}
