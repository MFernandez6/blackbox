import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canEdit } from "@/lib/auth";
import { docTypeEnum } from "@/lib/schemas/claim";
import { registerDocumentAction } from "@/lib/actions/claims";
import { storeClaimDocument } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !canEdit(session.user.role)) {
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

    // Soft size guard (Vercel hobby request body ~4.5MB)
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

    const result = await registerDocumentAction({
      claimId,
      fileName: file.name,
      fileUrl: stored.fileUrl,
      fileSizeBytes: bytes.length,
      mimeType: file.type || "application/octet-stream",
      docType: docTypeParsed.data,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ id: result.data.id, fileUrl: stored.fileUrl });
  } catch (e) {
    console.error("Upload failed:", e);
    const message =
      e instanceof Error ? e.message : "Upload failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
