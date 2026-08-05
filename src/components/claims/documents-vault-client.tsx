"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { DocType, AdjusterRole } from "@prisma/client";
import { DOC_TYPE_LABELS } from "@/lib/claims/labels";
import { canEdit } from "@/lib/auth-client";
import { DocumentUploadDialog } from "@/components/claims/document-upload-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  docType: DocType;
  uploadedAt: string;
  uploaderName: string;
  extractionStatus?: string;
};

type Props = {
  claimId: string;
  claimNumber: string;
  documents: Doc[];
  role: AdjusterRole;
  embedded?: boolean;
};

type SortKey = "date" | "name" | "type";

const ALL_DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

function mimeBadge(mimeType: string): "PDF" | "IMG" | "FILE" {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "IMG";
  return "FILE";
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string) {
  return mimeType === "application/pdf";
}

export function DocumentsVaultClient({
  claimId,
  claimNumber,
  documents,
  role,
  embedded = false,
}: Props) {
  const editable = canEdit(role);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const counts = useMemo(() => {
    const byType = {} as Record<DocType, number>;
    for (const t of ALL_DOC_TYPES) byType[t] = 0;
    for (const d of documents) byType[d.docType]++;
    return { all: documents.length, byType };
  }, [documents]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? documents : documents.filter((d) => d.docType === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((d) => d.fileName.toLowerCase().includes(q));

    return [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.fileName.localeCompare(b.fileName);
        case "type":
          return a.docType.localeCompare(b.docType);
        case "date":
        default:
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });
  }, [documents, filter, search, sort]);

  return (
    <div className="space-y-6">
      {embedded ? (
        editable ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          </div>
        ) : null
      ) : (
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
      )}

      <div className="space-y-4 border border-brand-white/10 p-4">
        <p className="eyebrow">Filter by Type</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "border px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em]",
              filter === "all"
                ? "border-brand-gold bg-brand-gold text-brand-navy"
                : "border-brand-white/10 text-brand-slate hover:border-brand-gold/40"
            )}
          >
            All <span className="opacity-80">({counts.all})</span>
          </button>
          {ALL_DOC_TYPES.map((t) => {
            const count = counts.byType[t];
            if (count === 0) return null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={cn(
                  "border px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em]",
                  filter === t
                    ? "border-brand-gold bg-brand-gold text-brand-navy"
                    : "border-brand-white/10 text-brand-slate hover:border-brand-gold/40"
                )}
              >
                {DOC_TYPE_LABELS[t]}{" "}
                <span className="opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-4 pt-2">
          <div className="min-w-[200px] flex-1 space-y-1">
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Search filename
            </p>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name…"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Sort
            </p>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-brand-white/10 px-6 py-16 text-center">
          <p className="eyebrow mb-2">Secure Record</p>
          <p className="text-sm text-brand-slate">No documents on file</p>
        </div>
      ) : (
        <div className="border border-brand-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-white/10 bg-brand-navy-deep/50">
              <tr>
                <th className="w-12 px-2 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Fmt
                </th>
                <th className="px-3 py-2 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  File
                </th>
                <th className="px-3 py-2 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Type
                </th>
                <th className="px-3 py-2 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Uploaded
                </th>
                <th className="px-3 py-2 text-left font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  By
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewDoc(d)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreviewDoc(d);
                    }
                  }}
                  className="cursor-pointer border-b border-brand-white/10 last:border-0 hover:bg-brand-gold/5"
                >
                  <td className="px-2 py-2">
                    <span className="font-mono text-[9px] font-bold tracking-wider text-brand-slate">
                      {mimeBadge(d.mimeType)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-brand-white">{d.fileName}</span>
                      {d.extractionStatus ? (
                        <Badge className="border-brand-white/10 text-brand-slate">
                          {d.extractionStatus}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-brand-slate">
                    {DOC_TYPE_LABELS[d.docType]}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-brand-slate">
                    {format(new Date(d.uploadedAt), "yyyy-MM-dd")}
                  </td>
                  <td className="px-3 py-2 text-brand-slate">{d.uploaderName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {previewDoc ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-8">{previewDoc.fileName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="eyebrow">Type</dt>
                    <dd className="font-mono text-xs text-brand-white">
                      {DOC_TYPE_LABELS[previewDoc.docType]}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Uploaded</dt>
                    <dd className="font-mono text-xs text-brand-white">
                      {format(new Date(previewDoc.uploadedAt), "yyyy-MM-dd HH:mm")} ·{" "}
                      {previewDoc.uploaderName}
                    </dd>
                  </div>
                  {previewDoc.extractionStatus ? (
                    <div>
                      <dt className="eyebrow">Extraction</dt>
                      <dd>
                        <Badge className="border-brand-white/10 text-brand-slate">
                          {previewDoc.extractionStatus}
                        </Badge>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {isImage(previewDoc.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.fileName}
                    className="max-h-[60vh] w-full border border-brand-white/10 object-contain"
                  />
                ) : isPdf(previewDoc.mimeType) ? (
                  <iframe
                    src={previewDoc.fileUrl}
                    title={previewDoc.fileName}
                    className="h-[60vh] w-full border border-brand-white/10 bg-white"
                  />
                ) : (
                  <div className="space-y-3 border border-brand-white/10 p-4">
                    <p className="text-sm text-brand-slate">
                      Preview not available for this file type.
                    </p>
                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="eyebrow">MIME</dt>
                        <dd className="font-mono text-xs">{previewDoc.mimeType}</dd>
                      </div>
                    </dl>
                    <Button asChild size="sm" variant="outline">
                      <a href={previewDoc.fileUrl} download={previewDoc.fileName}>
                        Download file
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <DocumentUploadDialog
        claimId={claimId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  );
}
