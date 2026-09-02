import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchNextDocument } from "@/lib/integrations/blackletter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * What document does this file need next?
 * Prefers live BLACKLETTER; falls back to the same stage map on this file's vault.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const claimId = req.nextUrl.searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      claimNumber: true,
      status: true,
      documents: {
        select: { fileName: true, docType: true, extractedData: true },
      },
    },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const result = await fetchNextDocument({
    claimId: claim.id,
    claimNumber: claim.claimNumber,
    status: claim.status,
    documents: claim.documents.map((d) => {
      const meta =
        d.extractedData &&
        typeof d.extractedData === "object" &&
        !Array.isArray(d.extractedData)
          ? (d.extractedData as { source?: string; documentType?: string })
          : {};
      return {
        fileName: d.fileName,
        docType: d.docType,
        extractedType: meta.documentType ?? null,
        source:
          meta.source === "BLACKGATE" || meta.source === "BLACKLETTER"
            ? meta.source
            : null,
      };
    }),
  });

  return NextResponse.json({ configured: true, ...result });
}
