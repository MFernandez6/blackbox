"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { DocType, AdjusterRole } from "@prisma/client";
import { DOC_TYPE_LABELS } from "@/lib/claims/labels";
import { canEdit } from "@/lib/auth-client";
import { DocumentUploadDialog } from "@/components/claims/document-upload-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Doc = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  docType: DocType;
  uploadedAt: string;
  uploaderName: string;
};

type Props = {
  claimId: string;
  claimNumber: string;
  documents: Doc[];
  role: AdjusterRole;
};

export function DocumentsVaultClient({
  claimId,
  claimNumber,
  documents,
  role,
}: Props) {
  const editable = canEdit(role);
  const [filter, setFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return documents;
    return documents.filter((d) => d.docType === filter);
  }, [documents, filter]);

  const photos = filtered.filter(
    (d) => d.docType === "PHOTO" || d.mimeType.startsWith("image/")
  );
  const others = filtered.filter(
    (d) => !(d.docType === "PHOTO" || d.mimeType.startsWith("image/"))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">File Integrity</p>
          <h1 className="mt-1 font-serif text-2xl text-brand-white">Document Vault</h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-brand-slate">
            <Link href={`/claims/${claimId}`} className="hover:text-brand-gold">
              {claimNumber}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/claims/${claimId}`}>Back to File</Link>
          </Button>
          {editable ? (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4 border border-brand-white/10 p-4">
        <p className="eyebrow shrink-0">Filter by Type</p>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All documents</SelectItem>
            {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-brand-white/10 px-6 py-16 text-center">
          <p className="eyebrow mb-2">Secure Record</p>
          <p className="text-sm text-brand-slate">No documents on file</p>
        </div>
      ) : (
        <>
          {photos.length > 0 ? (
            <section>
              <p className="eyebrow mb-4">Photo Evidence</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((d) => (
                  <a
                    key={d.id}
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group border border-brand-white/10 bg-brand-navy-deep/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.fileUrl}
                      alt={d.fileName}
                      className="aspect-[4/3] w-full object-cover opacity-90 group-hover:opacity-100"
                    />
                    <div className="border-t border-brand-white/10 px-3 py-2">
                      <p className="truncate text-sm text-brand-white">{d.fileName}</p>
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                        {format(new Date(d.uploadedAt), "yyyy-MM-dd")} ·{" "}
                        {d.uploaderName}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {others.length > 0 ? (
            <section className="border border-brand-white/10">
              <div className="border-b border-brand-white/10 px-4 py-3">
                <p className="eyebrow">Records</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-white/10 text-left">
                    <th className="px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      File
                    </th>
                    <th className="px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      Type
                    </th>
                    <th className="px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      Uploaded
                    </th>
                    <th className="px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-brand-white/10 last:border-0 hover:bg-brand-gold/5"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-white hover:underline"
                        >
                          {d.fileName}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-slate">
                        {DOC_TYPE_LABELS[d.docType]}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-slate">
                        {format(new Date(d.uploadedAt), "yyyy-MM-dd")}
                      </td>
                      <td className="px-4 py-3 text-brand-slate">
                        {d.uploaderName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      )}

      <DocumentUploadDialog
        claimId={claimId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  );
}
