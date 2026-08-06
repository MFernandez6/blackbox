"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DocType, PolicyLine } from "@prisma/client";
import { DOC_TYPE_LABELS, POLICY_LINE_LABELS } from "@/lib/claims/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  claimId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill doc type (e.g. POLICY for certified copy upload) */
  defaultDocType?: DocType;
  /** Show optional product-line hint when uploading policies */
  showPolicyLineHint?: boolean;
};

export function DocumentUploadDialog({
  claimId,
  open,
  onOpenChange,
  defaultDocType,
  showPolicyLineHint = false,
}: Props) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocType | "">("");
  const [policyLine, setPolicyLine] = useState<PolicyLine | "AUTO">("AUTO");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setDocType(defaultDocType ?? "");
      setPolicyLine("AUTO");
      setFile(null);
      setError("");
    }
  }, [open, defaultDocType]);

  async function upload() {
    setError("");
    if (!file) {
      setError("Select a file.");
      return;
    }
    if (!docType) {
      setError("Select a document type before upload completes.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("claimId", claimId);
      form.append("docType", docType);
      if (
        docType === "POLICY" &&
        showPolicyLineHint &&
        policyLine !== "AUTO"
      ) {
        form.append("policyLine", policyLine);
      }

      const res = await fetch("/api/upload", { method: "POST", body: form });
      let data: { error?: string; id?: string; fileUrl?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError(
          res.ok
            ? "Upload completed but response was unreadable."
            : `Upload failed (${res.status}).`
        );
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Upload failed (${res.status}).`);
        return;
      }

      toast.success(
        docType === "POLICY"
          ? "Policy lodged — run Parse Policy to extract coverage"
          : "Document lodged in vault"
      );
      setFile(null);
      setDocType("");
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Network error. Upload not recorded.");
    } finally {
      setUploading(false);
    }
  }

  const showLine =
    showPolicyLineHint && (docType === "POLICY" || defaultDocType === "POLICY");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow">File Integrity</p>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        {error ? (
          <ErrorBanner message={error} onDismiss={() => setError("")} />
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select
              value={docType}
              onValueChange={(v) => setDocType(v as DocType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showLine ? (
            <div className="space-y-2">
              <Label>Product line (optional hint)</Label>
              <Select
                value={policyLine}
                onValueChange={(v) =>
                  setPolicyLine(v as PolicyLine | "AUTO")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Auto-detect on parse</SelectItem>
                  {Object.entries(POLICY_LINE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div
            className={`border border-dashed px-4 py-10 text-center transition-colors ${
              dragging
                ? "border-brand-gold bg-secondary"
                : "border-brand-white/10"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            <p className="eyebrow mb-2">Drop file</p>
            <p className="text-sm text-brand-slate">
              {file ? file.name : "Or select from disk"}
            </p>
            <input
              type="file"
              className="mt-4 block w-full text-sm text-brand-slate file:mr-4 file:border file:border-brand-white/10 file:bg-brand-navy file:px-3 file:py-1.5 file:font-sans file:text-[10px] file:uppercase file:tracking-[0.12em] file:text-brand-white"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={uploading}>
            {uploading ? "Lodging…" : "Lodge Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
