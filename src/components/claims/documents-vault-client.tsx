"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { DocType, AdjusterRole, PolicyLine } from "@prisma/client";
import { DOC_TYPE_LABELS, POLICY_LINE_LABELS } from "@/lib/claims/labels";
import { canEdit } from "@/lib/auth-client";
import { parsePolicyDocumentAction } from "@/lib/actions/claim-policies";
import {
  deleteDocumentAction,
  renameDocumentAction,
  replaceDocumentFileAction,
  updateDocumentMetaAction,
} from "@/lib/actions/documents";
import { DocumentUploadDialog } from "@/components/claims/document-upload-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBanner } from "@/components/ui/error-banner";
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
  DialogFooter,
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
  policyLine?: PolicyLine | null;
  isCertifiedPolicy?: boolean;
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
const LINE_OPTIONS = Object.entries(POLICY_LINE_LABELS) as Array<
  [PolicyLine, string]
>;

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

function canParseAsPolicy(doc: Doc) {
  return (
    doc.docType === "POLICY" ||
    isPdf(doc.mimeType) ||
    isImage(doc.mimeType) ||
    doc.fileName.toLowerCase().endsWith(".pdf")
  );
}

function extractionBadgeClass(status: string) {
  switch (status) {
    case "COMPLETE":
      return "border-brand-gold text-brand-gold";
    case "PENDING":
      return "border-brand-slate/50 text-brand-slate";
    case "FAILED":
      return "border-denied text-denied";
    case "NOT_APPLICABLE":
      return "border-brand-white/10 text-brand-slate/70";
    default:
      return "border-brand-white/10 text-brand-slate";
  }
}

function ExtractionBadge({ status }: { status: string }) {
  return (
    <Badge className={extractionBadgeClass(status)}>{status}</Badge>
  );
}

export function DocumentsVaultClient({
  claimId,
  claimNumber,
  documents,
  role,
  embedded = false,
}: Props) {
  const router = useRouter();
  const editable = canEdit(role);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [parseDoc, setParseDoc] = useState<Doc | null>(null);
  const [parseHint, setParseHint] = useState<PolicyLine | "AUTO">("AUTO");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [manageDoc, setManageDoc] = useState<Doc | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [metaDocType, setMetaDocType] = useState<DocType>("OTHER");
  const [certified, setCertified] = useState(false);
  const [managing, setManaging] = useState(false);
  const [manageError, setManageError] = useState("");

  const counts = useMemo(() => {
    const byType = {} as Record<DocType, number>;
    for (const t of ALL_DOC_TYPES) byType[t] = 0;
    for (const d of documents) byType[d.docType]++;
    return { all: documents.length, byType };
  }, [documents]);

  const filtered = useMemo(() => {
    let list =
      filter === "all"
        ? documents
        : documents.filter((d) => d.docType === filter);
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
          return (
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );
      }
    });
  }, [documents, filter, search, sort]);

  function openParse(doc: Doc) {
    setParseError("");
    setParseHint(doc.policyLine ?? "AUTO");
    setParseDoc(doc);
  }

  function openManage(doc: Doc) {
    setManageError("");
    setManageDoc(doc);
    setRenameValue(doc.fileName);
    setMetaDocType(doc.docType);
    setCertified(!!doc.isCertifiedPolicy);
  }

  function closeManage() {
    setManageDoc(null);
    setManageError("");
    setManaging(false);
  }

  async function runParse() {
    if (!parseDoc) return;
    setParseError("");
    setParsing(true);
    try {
      const hint = parseHint === "AUTO" ? null : parseHint;
      const result = await parsePolicyDocumentAction(
        claimId,
        parseDoc.id,
        hint
      );
      if (!result.ok) {
        setParseError(result.error);
        return;
      }
      toast.success(result.data.message);
      setParseDoc(null);
      setPreviewDoc(null);
      router.refresh();
    } finally {
      setParsing(false);
    }
  }

  async function saveRename() {
    if (!manageDoc) return;
    const fileName = renameValue.trim();
    if (!fileName) {
      setManageError("File name is required.");
      return;
    }
    setManageError("");
    setManaging(true);
    try {
      const result = await renameDocumentAction(claimId, {
        documentId: manageDoc.id,
        fileName,
      });
      if (!result.ok) {
        setManageError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Document renamed");
      setManageDoc({ ...manageDoc, fileName });
      router.refresh();
    } finally {
      setManaging(false);
    }
  }

  async function saveMeta(next?: {
    docType?: DocType;
    isCertifiedPolicy?: boolean;
  }) {
    if (!manageDoc) return;
    const docType = next?.docType ?? metaDocType;
    const isCertifiedPolicy = next?.isCertifiedPolicy ?? certified;
    setManageError("");
    setManaging(true);
    try {
      const result = await updateDocumentMetaAction(claimId, {
        documentId: manageDoc.id,
        docType,
        isCertifiedPolicy,
      });
      if (!result.ok) {
        setManageError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Document updated");
      setMetaDocType(docType);
      setCertified(isCertifiedPolicy);
      setManageDoc({
        ...manageDoc,
        docType,
        isCertifiedPolicy,
      });
      router.refresh();
    } finally {
      setManaging(false);
    }
  }

  async function onReplaceFile(file: File | undefined) {
    if (!manageDoc || !file) return;
    setManageError("");
    setManaging(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await replaceDocumentFileAction(
        claimId,
        manageDoc.id,
        formData
      );
      if (!result.ok) {
        setManageError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("File replaced");
      closeManage();
      setPreviewDoc(null);
      router.refresh();
    } finally {
      setManaging(false);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  }

  async function onDelete() {
    if (!manageDoc) return;
    if (
      !confirm(
        `Delete “${manageDoc.fileName}”? This cannot be undone.`
      )
    ) {
      return;
    }
    setManageError("");
    setManaging(true);
    try {
      const result = await deleteDocumentAction(claimId, manageDoc.id);
      if (!result.ok) {
        setManageError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Document deleted");
      closeManage();
      setPreviewDoc(null);
      router.refresh();
    } finally {
      setManaging(false);
    }
  }

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
            <h1 className="mt-1 font-serif text-2xl text-brand-white">
              Document Vault
            </h1>
            <p className="mt-1 font-mono text-xs tracking-wide text-brand-slate">
              <Link
                href={`/claims/${claimId}`}
                className="hover:text-brand-gold"
              >
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

        <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
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
          <div className="w-full space-y-1 sm:w-auto">
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Sort
            </p>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-full sm:w-[140px]">
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
                {editable ? (
                  <th className="px-3 py-2 text-right font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                    Actions
                  </th>
                ) : null}
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
                      <span className="truncate text-brand-white">
                        {d.fileName}
                      </span>
                      {d.isCertifiedPolicy ? (
                        <Badge className="border-brand-gold text-brand-gold">
                          Certified
                        </Badge>
                      ) : null}
                      {d.extractionStatus ? (
                        <ExtractionBadge status={d.extractionStatus} />
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
                  {editable ? (
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canParseAsPolicy(d) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openParse(d);
                            }}
                          >
                            Parse
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openManage(d);
                          }}
                        >
                          Manage
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {previewDoc ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-8">
                  {previewDoc.fileName}
                </DialogTitle>
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
                      {format(
                        new Date(previewDoc.uploadedAt),
                        "yyyy-MM-dd HH:mm"
                      )}{" "}
                      · {previewDoc.uploaderName}
                    </dd>
                  </div>
                  {previewDoc.isCertifiedPolicy ? (
                    <div>
                      <dt className="eyebrow">Status</dt>
                      <dd>
                        <Badge className="border-brand-gold text-brand-gold">
                          Certified
                        </Badge>
                      </dd>
                    </div>
                  ) : null}
                  {previewDoc.extractionStatus ? (
                    <div>
                      <dt className="eyebrow">Extraction</dt>
                      <dd>
                        <ExtractionBadge status={previewDoc.extractionStatus} />
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {editable ? (
                  <div className="flex flex-wrap gap-2">
                    {canParseAsPolicy(previewDoc) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="solid"
                        onClick={() => openParse(previewDoc)}
                      >
                        Parse as Policy
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openManage(previewDoc)}
                    >
                      Manage
                    </Button>
                  </div>
                ) : null}

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
                        <dd className="font-mono text-xs">
                          {previewDoc.mimeType}
                        </dd>
                      </div>
                    </dl>
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={previewDoc.fileUrl}
                        download={previewDoc.fileName}
                      >
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

      <Dialog
        open={!!parseDoc}
        onOpenChange={(open) => {
          if (!open) {
            setParseDoc(null);
            setParseError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow">Coverage Protocol</p>
            <DialogTitle>Parse Policy Document</DialogTitle>
          </DialogHeader>

          {parseError ? (
            <ErrorBanner
              message={parseError}
              onDismiss={() => setParseError("")}
            />
          ) : null}

          {parseDoc ? (
            <div className="space-y-4">
              <p className="text-sm text-brand-slate">
                Extract coverage limits from{" "}
                <span className="text-brand-white">{parseDoc.fileName}</span>
                {parseDoc.docType !== "POLICY"
                  ? " and classify it as a Policy document on this file."
                  : "."}
              </p>
              <div className="space-y-2">
                <Label>Product line hint</Label>
                <Select
                  value={parseHint}
                  onValueChange={(v) =>
                    setParseHint(v as PolicyLine | "AUTO")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto-detect</SelectItem>
                    {LINE_OPTIONS.map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setParseDoc(null)}
              disabled={parsing}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              disabled={parsing || !parseDoc}
              onClick={() => void runParse()}
            >
              {parsing ? "Parsing…" : "Parse Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!manageDoc}
        onOpenChange={(open) => {
          if (!open && !managing) closeManage();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <p className="eyebrow">File Integrity</p>
            <DialogTitle>Manage Document</DialogTitle>
          </DialogHeader>

          {manageError ? (
            <ErrorBanner
              message={manageError}
              onDismiss={() => setManageError("")}
            />
          ) : null}

          {manageDoc ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="doc-rename">Rename</Label>
                <div className="flex gap-2">
                  <Input
                    id="doc-rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    disabled={managing}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="solid"
                    disabled={managing || !renameValue.trim()}
                    onClick={() => void saveRename()}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Document type</Label>
                <Select
                  value={metaDocType}
                  disabled={managing}
                  onValueChange={(v) => {
                    const next = v as DocType;
                    setMetaDocType(next);
                    void saveMeta({ docType: next });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {DOC_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="doc-certified"
                  checked={certified}
                  disabled={managing}
                  onCheckedChange={(c) => {
                    const next = !!c;
                    setCertified(next);
                    void saveMeta({ isCertifiedPolicy: next });
                  }}
                />
                <Label htmlFor="doc-certified" className="cursor-pointer">
                  Certified policy
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Replace file</Label>
                <input
                  ref={replaceInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void onReplaceFile(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={managing}
                  onClick={() => replaceInputRef.current?.click()}
                >
                  Choose replacement…
                </Button>
              </div>

              <div className="border-t border-brand-white/10 pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={managing}
                  onClick={() => void onDelete()}
                >
                  Delete document
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={managing}
              onClick={() => closeManage()}
            >
              Close
            </Button>
          </DialogFooter>
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
