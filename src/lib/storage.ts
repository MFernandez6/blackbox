import { mkdir, writeFile, readFile } from "fs/promises";
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

    const fileUrl = `${cfg.url}/storage/v1/object/public/${CLAIM_DOCS_BUCKET}/${objectPath}`;
    return { fileUrl, storagePath: objectPath };
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

/** Load document bytes from a public URL or local /uploads path. */
export async function readStoredDocumentBytes(
  fileUrl: string
): Promise<Buffer> {
  if (/^https?:\/\//i.test(fileUrl)) {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      throw new Error(`Unable to fetch document (${res.status}).`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  if (fileUrl.startsWith("/")) {
    const rel = fileUrl.replace(/^\//, "");
    const abs = path.join(
      process.cwd(),
      "public",
      rel.startsWith("uploads") ? rel : rel
    );
    return readFile(abs);
  }

  throw new Error("Unsupported document URL for reading.");
}
