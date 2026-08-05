import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canEdit } from "@/lib/auth";
import { docTypeEnum } from "@/lib/schemas/claim";
import { registerDocumentAction } from "@/lib/actions/claims";

export async function POST(req: NextRequest) {
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

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  const relDir = path.join("uploads", claimId);
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });

  const storedName = `${stamp}-${safeName}`;
  await writeFile(path.join(absDir, storedName), bytes);

  const fileUrl = `/${relDir}/${storedName}`.replace(/\\/g, "/");

  // AI_HOOK: after upload, call extraction service and
  // populate Document.extractedData + set extractionStatus

  const result = await registerDocumentAction({
    claimId,
    fileName: file.name,
    fileUrl,
    fileSizeBytes: bytes.length,
    mimeType: file.type || "application/octet-stream",
    docType: docTypeParsed.data,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ id: result.data.id, fileUrl });
}
