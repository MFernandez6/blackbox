import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanViewClaim } from "@/lib/claims/access";
import { getDocumentAccessUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Access-checked redirect to a short-lived signed URL for a claim document. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { claimId: true, fileUrl: true, fileName: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let gate;
  try {
    gate = await assertCanViewClaim(doc.claimId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: 403 });

  const download = req.nextUrl.searchParams.get("download") === "1";
  const url = await getDocumentAccessUrl(doc.fileUrl, {
    downloadName: download ? doc.fileName : undefined,
  });
  if (!url) return NextResponse.json({ error: "File unavailable." }, { status: 404 });

  const target = url.startsWith("/") ? new URL(url, req.nextUrl.origin) : url;
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
