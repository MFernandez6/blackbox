import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ExtractionStatus } from "@prisma/client";
import { authOptions, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { docTypeEnum } from "@/lib/schemas/claim";
import { storeClaimDocument } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canEdit(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const claimId = String(form.get("claimId") ?? "");
    const docTypeRaw = String(form.get("docType") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!claimId) {
      return NextResponse.json({ error: "claimId required." }, { status: 400 });
    }

    const docTypeParsed = docTypeEnum.safeParse(docTypeRaw);
    if (!docTypeParsed.success) {
      return NextResponse.json(
        { error: "Select a document type before upload completes." },
        { status: 400 }
      );
    }

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, assignedAdjusterId: true, isArchived: true },
    });
    if (!claim) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }
    if (claim.isArchived) {
      return NextResponse.json(
        { error: "Archived files are sealed." },
        { status: 400 }
      );
    }
    if (
      session.user.role === "ADJUSTER" &&
      claim.assignedAdjusterId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Not assigned to this file." },
        { status: 403 }
      );
    }

    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "File exceeds 20MB limit." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeClaimDocument({
      claimId,
      fileName: file.name,
      bytes,
      mimeType: file.type || "application/octet-stream",
    });

    const extractionStatus =
      docTypeParsed.data === "POLICY"
        ? ExtractionStatus.PENDING
        : ExtractionStatus.NOT_APPLICABLE;

    const doc = await prisma.document.create({
      data: {
        claimId,
        fileName: file.name,
        fileUrl: stored.fileUrl,
        fileSizeBytes: bytes.length,
        mimeType: file.type || "application/octet-stream",
        docType: docTypeParsed.data,
        uploadedById: session.user.id,
        extractionStatus,
      },
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath(`/claims/${claimId}/documents`);

    return NextResponse.json({ id: doc.id, fileUrl: stored.fileUrl });
  } catch (e) {
    console.error("Upload failed:", e);
    const message =
      e instanceof Error ? e.message : "Upload failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
