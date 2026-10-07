import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteStoredDocument,
  readStoredDocumentBytes,
  storePersonCard,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const person = await prisma.person.findUnique({
    where: { id: params.id },
    select: { cardImageUrl: true },
  });
  if (!person?.cardImageUrl) {
    return NextResponse.json({ error: "No card on file." }, { status: 404 });
  }

  try {
    const bytes = await readStoredDocumentBytes(person.cardImageUrl);
    const type = person.cardImageUrl.endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Card image unavailable." }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !canEdit(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const person = await prisma.person.findUnique({
      where: { id: params.id },
      select: { cardImageUrl: true },
    });
    if (!person) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Card photo must be an image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Card photo exceeds 8MB." }, { status: 400 });
    }

    const stored = await storePersonCard({
      personId: params.id,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });

    await prisma.person.update({
      where: { id: params.id },
      data: { cardImageUrl: stored.fileUrl, updatedById: session.user.id },
    });
    if (person.cardImageUrl) await deleteStoredDocument(person.cardImageUrl);

    revalidatePath(`/people/${params.id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Card upload failed:", e);
    return NextResponse.json({ error: "Card upload failed." }, { status: 500 });
  }
}
