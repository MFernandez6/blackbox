import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanEditClaim, assertCanViewClaim } from "@/lib/claims/access";
import { documentHref, storeClaimDocument } from "@/lib/storage";
import { detectAllowedFile } from "@/lib/security/file-signature";
import { contentsAiAvailable, identifyContentsItem } from "@/lib/ai/identify-contents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function money(value: { toString(): string } | null) {
  return value ? value.toString() : null;
}

function present(row: {
  id: string;
  room: string;
  quantity: number;
  itemName: string;
  brand: string | null;
  modelNumber: string | null;
  description: string | null;
  condition: string | null;
  matchKind: string;
  productTitle: string | null;
  productUrl: string | null;
  listedPrice: { toString(): string } | null;
  priceNote: string | null;
  confirmedUnitCost: { toString(): string } | null;
  confirmed: boolean;
  notes: string | null;
  sourceApp: string;
  documentId: string | null;
  createdAt: Date;
  createdBy: { name: string };
}) {
  return {
    id: row.id,
    room: row.room,
    quantity: row.quantity,
    itemName: row.itemName,
    brand: row.brand,
    modelNumber: row.modelNumber,
    description: row.description,
    condition: row.condition,
    matchKind: row.matchKind,
    productTitle: row.productTitle,
    productUrl: row.productUrl,
    listedPrice: money(row.listedPrice),
    priceNote: row.priceNote,
    confirmedUnitCost: money(row.confirmedUnitCost),
    confirmed: row.confirmed,
    notes: row.notes,
    sourceApp: row.sourceApp,
    photoHref: row.documentId ? documentHref({ id: row.documentId, fileUrl: "" }) : null,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdBy.name,
  };
}

const itemSelect = {
  id: true,
  room: true,
  quantity: true,
  itemName: true,
  brand: true,
  modelNumber: true,
  description: true,
  condition: true,
  matchKind: true,
  productTitle: true,
  productUrl: true,
  listedPrice: true,
  priceNote: true,
  confirmedUnitCost: true,
  confirmed: true,
  notes: true,
  sourceApp: true,
  documentId: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const gate = await assertCanViewClaim(params.id);
    if (gate.error) {
      return NextResponse.json({ error: gate.error }, { status: gate.error === "Claim not found." ? 404 : 403 });
    }
    const items = await prisma.contentsItem.findMany({
      where: { claimId: params.id },
      orderBy: { createdAt: "desc" },
      select: itemSelect,
    });
    return NextResponse.json({ items: items.map(present) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let gate;
  try {
    gate = await assertCanEditClaim(params.id);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (gate.error || !gate.claim) {
    return NextResponse.json({ error: gate.error ?? "Claim not found." }, { status: 403 });
  }
  if (!contentsAiAvailable()) {
    return NextResponse.json({ error: "Contents pricing is not configured." }, { status: 503 });
  }

  const form = await req.formData();
  const room = String(form.get("room") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
  if (room.length < 2) return NextResponse.json({ error: "Enter the room or area." }, { status: 422 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo must be 8 MB or smaller." }, { status: 413 });
  }
  const detected = detectAllowedFile(bytes, file.name || "contents.jpg");
  if (!detected || !IMAGE.has(detected.mime)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, or WEBP photo. The field camera converts phone photos automatically." },
      { status: 415 }
    );
  }

  let identified;
  try {
    identified = await identifyContentsItem({ bytes, mimeType: detected.mime, room });
  } catch (err) {
    console.error("[contents] identify failed", err);
    return NextResponse.json({ error: "The product search did not finish. Try the photo again." }, { status: 502 });
  }

  const stored = await storeClaimDocument({
    claimId: params.id,
    fileName: `contents-${room.slice(0, 24)}.${detected.ext}`,
    bytes,
    mimeType: detected.mime,
  });
  const document = await prisma.document.create({
    data: {
      claimId: params.id,
      fileName: stored.storagePath.split("/").pop() || "contents.jpg",
      fileUrl: stored.fileUrl,
      fileSizeBytes: bytes.byteLength,
      mimeType: detected.mime,
      docType: "PHOTO",
      uploadedById: gate.session.user.id,
    },
  });
  const item = await prisma.contentsItem.create({
    data: {
      claimId: params.id,
      room,
      quantity: identified.quantity,
      itemName: identified.itemName,
      brand: identified.brand,
      modelNumber: identified.modelNumber,
      description: identified.description,
      condition: identified.condition,
      matchKind: identified.matchKind,
      productTitle: identified.productTitle,
      productUrl: identified.productUrl,
      listedPrice: identified.listedPrice,
      priceNote: identified.priceNote,
      documentId: document.id,
      sourceApp: "BLACKBOX",
      createdById: gate.session.user.id,
    },
    select: itemSelect,
  });
  return NextResponse.json({ item: present(item) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let gate;
  try {
    gate = await assertCanEditClaim(params.id);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    quantity?: number;
    unitCost?: number | null;
    confirmed?: boolean;
    room?: string;
    notes?: string;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "Missing item." }, { status: 400 });
  const existing = await prisma.contentsItem.findFirst({
    where: { id: body.id, claimId: params.id },
    select: { id: true, listedPrice: true },
  });
  if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const quantity = Number(body.quantity);
  const typed = body.unitCost === null || body.unitCost === undefined ? null : Number(body.unitCost);
  const unit = typed !== null && Number.isFinite(typed) ? typed : null;
  let confirmedUnitCost: number | undefined;
  if (body.confirmed) {
    const cost = unit ?? (existing.listedPrice ? Number(existing.listedPrice) : null);
    if (cost === null || !Number.isFinite(cost) || cost < 0 || cost > 1_000_000) {
      return NextResponse.json({ error: "Enter a unit cost before confirming the line." }, { status: 422 });
    }
    confirmedUnitCost = Math.round(cost * 100) / 100;
  } else if (unit !== null && unit >= 0 && unit <= 1_000_000) {
    confirmedUnitCost = Math.round(unit * 100) / 100;
  }
  const item = await prisma.contentsItem.update({
    where: { id: existing.id },
    data: {
      ...(Number.isFinite(quantity) ? { quantity: Math.min(999, Math.max(1, Math.round(quantity))) } : {}),
      ...(confirmedUnitCost !== undefined ? { confirmedUnitCost } : {}),
      ...(typeof body.confirmed === "boolean" ? { confirmed: body.confirmed } : {}),
      ...(typeof body.room === "string" && body.room.trim().length > 1
        ? { room: body.room.replace(/[\r\n]+/g, " ").trim().slice(0, 80) }
        : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes.slice(0, 1000) } : {}),
    },
    select: itemSelect,
  });
  return NextResponse.json({ item: present(item) });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let gate;
  try {
    gate = await assertCanEditClaim(params.id);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: 403 });
  const itemId = new URL(req.url).searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "Missing item." }, { status: 400 });
  const existing = await prisma.contentsItem.findFirst({
    where: { id: itemId, claimId: params.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  await prisma.contentsItem.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
