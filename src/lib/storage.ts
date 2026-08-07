import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

export const CLAIM_DOCS_BUCKET = "claim-documents";

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export type StoredDocument = {
  fileUrl: string;
  storagePath: string;
};

function publicObjectUrl(cfg: { url: string }, objectPath: string) {
  return `${cfg.url}/storage/v1/object/public/${CLAIM_DOCS_BUCKET}/${objectPath}`;
}

function extractStoragePath(fileUrl: string): string | null {
  const marker = `/object/public/${CLAIM_DOCS_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx >= 0) return fileUrl.slice(idx + marker.length).split("?")[0];
  const signed = `/object/sign/${CLAIM_DOCS_BUCKET}/`;
  const sidx = fileUrl.indexOf(signed);
  if (sidx >= 0) {
    return fileUrl.slice(sidx + signed.length).split("?")[0];
  }
  if (fileUrl.startsWith("/uploads/")) {
    return fileUrl.replace(/^\//, "");
  }
  return null;
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
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${opts.claimId}/${Date.now()}-${safeName}`;
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
      fileUrl: publicObjectUrl(cfg, objectPath),
      storagePath: objectPath,
    };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "File storage is not configured for production. Set NEXT_PUBLIC_SUPABASE_URL and a Supabase API key (prefer SUPABASE_SERVICE_ROLE_KEY) in Vercel, then redeploy."
    );
  }

  const relDir = path.join("uploads", opts.claimId);
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const storedName = path.basename(objectPath);
  await writeFile(path.join(absDir, storedName), opts.bytes);
  const fileUrl = `/${relDir}/${storedName}`.replace(/\\/g, "/");
  return { fileUrl, storagePath: objectPath };
}

/** Create a time-limited signed URL when service role is available; else return stored URL. */
export async function getDocumentAccessUrl(
  fileUrl: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (process.env.STORAGE_USE_SIGNED_URLS !== "1") {
    return fileUrl;
  }

  const cfg = supabaseConfig();
  const objectPath = extractStoragePath(fileUrl);
  if (!cfg || !objectPath || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fileUrl;
  }

  const endpoint = `${cfg.url}/storage/v1/object/sign/${CLAIM_DOCS_BUCKET}/${objectPath}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!res.ok) return fileUrl;
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL || data.signedUrl;
  if (!signed) return fileUrl;
  if (signed.startsWith("http")) return signed;
  return `${cfg.url}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
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

/** Load document bytes from a public/signed URL or local /uploads path. */
export async function readStoredDocumentBytes(
  fileUrl: string
): Promise<Buffer> {
  const accessUrl = await getDocumentAccessUrl(fileUrl);

  if (/^https?:\/\//i.test(accessUrl)) {
    const res = await fetch(accessUrl);
    if (!res.ok) {
      throw new Error(`Unable to fetch document (${res.status}).`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  if (accessUrl.startsWith("/")) {
    const rel = accessUrl.replace(/^\//, "");
    const abs = path.join(process.cwd(), "public", rel);
    return readFile(abs);
  }

  throw new Error("Unsupported document URL for reading.");
}
