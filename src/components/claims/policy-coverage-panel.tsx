"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { DocType } from "@prisma/client";
import {
  updateCoverageAction,
  parsePolicyDocumentAction,
} from "@/lib/actions/claims";
import { DocumentUploadDialog } from "@/components/claims/document-upload-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";

export type PolicyDocSummary = {
  id: string;
  fileName: string;
  fileUrl: string;
  docType: DocType;
  uploadedAt: string;
  extractionStatus: string;
};

type CoverageState = {
  coverageALimit: string;
  coverageBLimit: string;
  coverageCLimit: string;
  coverageDLimit: string;
  policyExclusions: string;
  policyEndorsements: string;
  coverageAnalysis: string;
  policyNumber: string;
  carrierName: string;
};

type Props = {
  claimId: string;
  editable: boolean;
  policyParsedAt: string | null;
  initial: CoverageState;
  policyDocs: PolicyDocSummary[];
};

export function PolicyCoveragePanel({
  claimId,
  editable,
  policyParsedAt,
  initial,
  policyDocs,
}: Props) {
  const router = useRouter();
  const [coverage, setCoverage] = useState(initial);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const latestPolicy = policyDocs[0] ?? null;

  async function save() {
    setError("");
    setSaving(true);
    try {
      const result = await updateCoverageAction(claimId, {
        ...coverage,
        coverageALimit: coverage.coverageALimit || null,
        coverageBLimit: coverage.coverageBLimit || null,
        coverageCLimit: coverage.coverageCLimit || null,
        coverageDLimit: coverage.coverageDLimit || null,
        policyExclusions: coverage.policyExclusions || null,
        policyEndorsements: coverage.policyEndorsements || null,
        coverageAnalysis: coverage.coverageAnalysis || null,
        policyNumber: coverage.policyNumber || null,
        carrierName: coverage.carrierName || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Coverage record updated");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function parsePolicy() {
    setError("");
    setParsing(true);
    try {
      const result = await parsePolicyDocumentAction(
        claimId,
        latestPolicy?.id
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.applied) {
        toast.success(result.data.message);
        router.refresh();
      } else {
        toast.message(result.data.message);
        router.refresh();
      }
    } finally {
      setParsing(false);
    }
  }

  return (
    <section className="border border-brand-white/10 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Coverage Protocol</p>
          <p className="mt-1 text-sm text-brand-slate">
            Coverage A–D, exclusions, endorsements, and analysis from the
            certified policy.
          </p>
          {policyParsedAt ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-gold">
              Last parsed {format(new Date(policyParsedAt), "yyyy-MM-dd HH:mm")}
            </p>
          ) : null}
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setUploadOpen(true)}
            >
              Upload Certified Policy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="solid"
              disabled={parsing || !latestPolicy}
              onClick={parsePolicy}
            >
              {parsing ? "Parsing…" : "Parse Policy"}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner
          message={error}
          onDismiss={() => setError("")}
          className="mb-4"
        />
      ) : null}

      <div className="mb-5 border border-brand-white/10 bg-brand-navy-deep/40 px-4 py-3">
        <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Certified copy on file
        </p>
        {latestPolicy ? (
          <p className="mt-1 text-sm text-brand-white">
            <a
              href={latestPolicy.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-gold hover:underline"
            >
              {latestPolicy.fileName}
            </a>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
              {latestPolicy.extractionStatus}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-brand-slate">
            No POLICY document lodged. Upload a certified copy, then parse to
            populate Coverage A–D.
          </p>
        )}
        {/* AI_HOOK: display extractedData fields
            here once populated (policy number, date of loss, claimant name cross-check)
            and Coverage A–D / exclusions / endorsements */}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Coverage A — Dwelling">
          <Input
            disabled={!editable}
            inputMode="decimal"
            value={coverage.coverageALimit}
            onChange={(e) =>
              setCoverage({ ...coverage, coverageALimit: e.target.value })
            }
            placeholder="0.00"
          />
        </Field>
        <Field label="Coverage B — Other Structures">
          <Input
            disabled={!editable}
            inputMode="decimal"
            value={coverage.coverageBLimit}
            onChange={(e) =>
              setCoverage({ ...coverage, coverageBLimit: e.target.value })
            }
            placeholder="0.00"
          />
        </Field>
        <Field label="Coverage C — Personal Property">
          <Input
            disabled={!editable}
            inputMode="decimal"
            value={coverage.coverageCLimit}
            onChange={(e) =>
              setCoverage({ ...coverage, coverageCLimit: e.target.value })
            }
            placeholder="0.00"
          />
        </Field>
        <Field label="Coverage D — Loss of Use / ALE">
          <Input
            disabled={!editable}
            inputMode="decimal"
            value={coverage.coverageDLimit}
            onChange={(e) =>
              setCoverage({ ...coverage, coverageDLimit: e.target.value })
            }
            placeholder="0.00"
          />
        </Field>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Policy Exclusions">
          <Textarea
            disabled={!editable}
            rows={4}
            value={coverage.policyExclusions}
            onChange={(e) =>
              setCoverage({ ...coverage, policyExclusions: e.target.value })
            }
            placeholder="List material exclusions from the certified policy…"
          />
        </Field>
        <Field label="Endorsements">
          <Textarea
            disabled={!editable}
            rows={4}
            value={coverage.policyEndorsements}
            onChange={(e) =>
              setCoverage({ ...coverage, policyEndorsements: e.target.value })
            }
            placeholder="Forms / endorsements schedule…"
          />
        </Field>
        <Field label="Coverage Analysis">
          <Textarea
            disabled={!editable}
            rows={5}
            value={coverage.coverageAnalysis}
            onChange={(e) =>
              setCoverage({ ...coverage, coverageAnalysis: e.target.value })
            }
            placeholder="How limits, exclusions, and endorsements apply to this loss…"
          />
        </Field>
      </div>

      {editable ? (
        <Button
          className="mt-4"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save Coverage"}
        </Button>
      ) : null}

      <DocumentUploadDialog
        claimId={claimId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultDocType="POLICY"
      />
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
