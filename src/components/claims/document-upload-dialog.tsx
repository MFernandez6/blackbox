"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DocType } from "@prisma/client";
import { DOC_TYPE_LABELS } from "@/lib/claims/labels";
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
};

export function DocumentUploadDialog({ claimId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

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

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      toast.success("Document lodged in vault");
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

          <div
            className={`border border-dashed px-4 py-10 text-center transition-colors ${
              dragging ? "border-paper bg-secondary" : "border-hairline"
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
            <p className="text-sm text-muted-foreground">
              {file ? file.name : "Or select from disk"}
            </p>
            <input
              type="file"
              className="mt-4 block w-full text-sm text-muted-foreground file:mr-4 file:border file:border-hairline file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.12em] file:text-paper"
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
