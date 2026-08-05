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
          <h1 className="mt-1 font-serif text-2xl text-paper">Document Vault</h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-muted-foreground">
            <Link href={`/claims/${claimId}`} className="hover:text-paper">
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

      <div className="flex items-center gap-4 border border-hairline p-4">
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
        <div className="border border-hairline px-6 py-16 text-center">
          <p className="eyebrow mb-2">Secure Record</p>
          <p className="text-sm text-muted-foreground">No documents on file</p>
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
                    className="group border border-hairline bg-[#0C0C0C]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.fileUrl}
                      alt={d.fileName}
                      className="aspect-[4/3] w-full object-cover opacity-90 group-hover:opacity-100"
                    />
                    <div className="border-t border-hairline px-3 py-2">
                      <p className="truncate text-sm text-paper">{d.fileName}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
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
            <section className="border border-hairline">
              <div className="border-b border-hairline px-4 py-3">
                <p className="eyebrow">Records</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      File
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Uploaded
                    </th>
                    <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-hairline last:border-0 hover:bg-[#0F0F0F]"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-paper hover:underline"
                        >
                          {d.fileName}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {DOC_TYPE_LABELS[d.docType]}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {format(new Date(d.uploadedAt), "yyyy-MM-dd")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
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
