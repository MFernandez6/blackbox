import type { ClaimStatus, DocType } from "@prisma/client";
import {
  computeNextDocument,
  inferLetterType,
  type ExistingLetterDoc,
  type NextDocumentResult,
} from "@/lib/letter/stage-map";

export type BlackletterNextDocument = NextDocumentResult;

export function blackletterAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_BLACKLETTER_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const api = process.env.BLACKLETTER_API_URL?.replace(/\/$/, "");
  return api ?? null;
}

export async function fetchNextDocument(opts: {
  claimId: string;
  claimNumber: string;
  status: ClaimStatus;
  aobApplicable?: boolean;
  documents?: Array<{
    fileName: string;
    docType: DocType;
    extractedType?: string | null;
    source?: "BLACKGATE" | "BLACKLETTER" | null;
  }>;
}): Promise<BlackletterNextDocument> {
  const live = await fetchLiveNextDocument(opts);
  if (live) return { ...live, source: "BLACKLETTER" };

  const existing: ExistingLetterDoc[] = [];
  for (const doc of opts.documents ?? []) {
    const documentType = inferLetterType({
      fileName: doc.fileName,
      docType: doc.docType,
      extractedType: doc.extractedType,
    });
    if (!documentType) continue;
    existing.push({
      documentType,
      status: "executed",
      source: doc.source === "BLACKGATE" || doc.source === "BLACKLETTER"
        ? doc.source
        : "VAULT",
    });
  }

  return computeNextDocument({
    claimId: opts.claimId,
    claimNumber: opts.claimNumber,
    claimStatus: opts.status,
    aobApplicable: opts.aobApplicable,
    existing,
  });
}

async function fetchLiveNextDocument(opts: {
  claimId: string;
  claimNumber: string;
  status: ClaimStatus;
  aobApplicable?: boolean;
}): Promise<Omit<BlackletterNextDocument, "source"> | null> {
  const base = process.env.BLACKLETTER_API_URL?.replace(/\/$/, "");
  const key = process.env.BLACKLETTER_API_KEY;
  if (!base || !key) return null;

  const params = new URLSearchParams({
    claimId: opts.claimId,
    claimNumber: opts.claimNumber,
    status: opts.status,
  });
  if (opts.aobApplicable !== undefined) {
    params.set("aobApplicable", String(opts.aobApplicable));
  }

  try {
    const res = await fetch(`${base}/api/next-document?${params}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Omit<BlackletterNextDocument, "source">;
  } catch {
    return null;
  }
}
