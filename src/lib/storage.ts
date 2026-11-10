import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

export const CLAIM_DOCS_BUCKET = "claim-documents";
/** Signed links handed to the browser expire quickly; the app re-signs on every view. */
export const SIGNED_URL_TTL_SECONDS = 300;

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) return { url, key: serviceKey };
  if (process.env.VERCEL) {
    if (url) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required in production; claim files live in a private bucket."
      );
    }
    return null;
  }
  const devKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !devKey) return null;
  return { url, key: devKey };
}

export type StoredDocument = {
  fileUrl: string;
  storagePath: string;
};

/**
 * Canonical object reference persisted in Document.fileUrl. The bucket is
 * private, so this URL is an identifier only — it never grants access.
 */
function canonicalObjectUrl(cfg: { url: string }, objectPath: string) {
  return `${cfg.url}/storage/v1/object/public/${CLAIM_DOCS_BUCKET}/${objectPath}`;
}

export function extractStoragePath(fileUrl: string): string | null {
  for (const marker of [
    `/object/public/${CLAIM_DOCS_BUCKET}/`,
    `/object/sign/${CLAIM_DOCS_BUCKET}/`,
    `/object/authenticated/${CLAIM_DOCS_BUCKET}/`,
  ]) {
    const idx = fileUrl.indexOf(marker);
    if (idx >= 0) return decodeURIComponent(fileUrl.slice(idx + marker.length).split("?")[0]);
  }
  if (fileUrl.startsWith("/uploads/")) {
    return fileUrl.replace(/^\//, "");
  }
  return null;
}

export function isExternalDocumentUrl(fileUrl: string): boolean {
  return /^https:\/\/docs\.google\.com\//i.test(fileUrl);
}

/** Browser-facing link for a Document: access-checked app route, or the Google Doc itself. */
export function documentHref(doc: { id: string; fileUrl: string }): string {
  if (isExternalDocumentUrl(doc.fileUrl)) return doc.fileUrl;
  return `/api/documents/${doc.id}/file`;
}

/**
 * Persist a claim document via Supabase Storage REST API (Vercel-safe).
 * Falls back to public/uploads for local dev when Supabase is not configured.
 */
export async function storeClaimDocument(opts: {
  claimId: string;
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<StoredDocument> {
  return storeObject({ folder: opts.claimId, ...opts });
}

/** Business card photo for a People directory entry. */
export async function storePersonCard(opts: {
  personId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<StoredDocument> {
  const ext = opts.mimeType === "image/png" ? "png" : "jpg";
  return storeObject({
    folder: `people/${opts.personId}`,
    fileName: `card.${ext}`,
    bytes: opts.bytes,
    mimeType: opts.mimeType,
  });
}

async function storeObject(opts: {
  folder: string;
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<StoredDocument> {
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${opts.folder}/${Date.now()}-${safeName}`;
  const cfg = supabaseConfig();

  if (cfg) {
    const endpoint = `${cfg.url}/storage/v1/object/${CLAIM_DOCS_BUCKET}/${objectPath}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        apikey: cfg.key,
        "Content-Type": opts.mimeType || "application/octet-stream",
        "x-upsert": "false",
      },
      body: new Uint8Array(opts.bytes),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Storage upload failed (${res.status}): ${detail || res.statusText}`
      );
    }

    return {
      fileUrl: canonicalObjectUrl(cfg, objectPath),
      storagePath: objectPath,
    };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "File storage is not configured for production. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy."
    );
  }

  const relDir = path.join("uploads", opts.folder);
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const storedName = path.basename(objectPath);
  await writeFile(path.join(absDir, storedName), opts.bytes);
  const fileUrl = `/${relDir}/${storedName}`.replace(/\\/g, "/");
  return { fileUrl, storagePath: objectPath };
}

/** Short-lived signed URL for a stored object (null when the URL is not a storage object). */
export async function getDocumentAccessUrl(
  fileUrl: string,
  opts: { expiresInSeconds?: number; downloadName?: string } = {}
): Promise<string | null> {
  if (isExternalDocumentUrl(fileUrl)) return fileUrl;
  const objectPath = extractStoragePath(fileUrl);
  if (!objectPath) return null;
  if (objectPath.startsWith("uploads/")) return `/${objectPath}`;

  const cfg = supabaseConfig();
  if (!cfg) return null;

  const endpoint = `${cfg.url}/storage/v1/object/sign/${CLAIM_DOCS_BUCKET}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: opts.expiresInSeconds ?? SIGNED_URL_TTL_SECONDS }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[storage] sign failed (${res.status}) for ${objectPath}`);
    return null;
  }
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL || data.signedUrl;
  if (!signed) return null;
  const absolute = signed.startsWith("http")
    ? signed
    : `${cfg.url}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
  if (!opts.downloadName) return absolute;
  const sep = absolute.includes("?") ? "&" : "?";
  return `${absolute}${sep}download=${encodeURIComponent(opts.downloadName)}`;
}

export async function deleteStoredDocument(fileUrl: string): Promise<void> {
  const objectPath = extractStoragePath(fileUrl);
  if (!objectPath) return;

  const cfg = supabaseConfig();
  if (cfg && !objectPath.startsWith("uploads/")) {
    const endpoint = `${cfg.url}/storage/v1/object/${CLAIM_DOCS_BUCKET}/${objectPath}`;
    await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        apikey: cfg.key,
      },
    }).catch(() => undefined);
    return;
  }

  if (objectPath.startsWith("uploads/") || fileUrl.startsWith("/uploads/")) {
    const abs = path.join(process.cwd(), "public", objectPath);
    await unlink(abs).catch(() => undefined);
  }
}

/** Load document bytes server-side with the service key (works with private buckets). */
export async function readStoredDocumentBytes(
  fileUrl: string
): Promise<Buffer> {
  const objectPath = extractStoragePath(fileUrl);

  if (objectPath?.startsWith("uploads/")) {
    return readFile(path.join(process.cwd(), "public", objectPath));
  }

  const cfg = supabaseConfig();
  if (objectPath && cfg) {
    const res = await fetch(
      `${cfg.url}/storage/v1/object/authenticated/${CLAIM_DOCS_BUCKET}/${objectPath}`,
      { headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key }, cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error(`Unable to fetch document (${res.status}).`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Unable to fetch document (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("Unsupported document URL for reading.");
}
