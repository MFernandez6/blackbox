"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { ReportDetailsForm } from "@/components/claims/report-details-form";
import { Button } from "@/components/ui/button";

type Doc = ClaimWorkspaceProps["claim"]["documents"][number];

const SKETCH_RE = /sketch/i;
const PHOTO_REPORT_RE = /(photo|image|picture)s?[\s_-]*(report|sheet|log|book)/i;

function isPhotoReport(d: Doc) {
  return (
    PHOTO_REPORT_RE.test(d.fileName) ||
    (d.docType === "PHOTO" && d.mimeType === "application/pdf")
  );
}

export function ReportsTab({
  claim,
  letterUrl,
  ...rest
}: ClaimWorkspaceProps & { letterUrl: string }) {
  const report = claim.summaryReport;
  const sketches = claim.documents.filter((d) => SKETCH_RE.test(d.fileName));
  const photoReports = claim.documents.filter(isPhotoReport);
  const reportHref = `/claims/${claim.id}/summary-report`;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Summary Report</p>
            <p className="mt-2 font-serif text-lg text-brand-white">Summary Report</p>
            <p className="mt-1 text-sm text-brand-slate">
              {report.saved
                ? `${report.saved.status === "FINAL" ? "Final" : "Draft"} · saved ${format(
                    new Date(report.saved.updatedAt),
                    "MMM d, yyyy"
                  )}${report.saved.updatedBy ? ` by ${report.saved.updatedBy}` : ""}${
                    report.saved.updatedVia === "BLACKLETTER" ? " in BLACKLETTER" : ""
                  }`
                : "Not started — opens pre-filled from this claim file"}
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-brand-gold">
              {report.completed} of {report.total} sections complete
            </p>
            {report.missing.length ? (
              <p className="mt-1 text-xs text-denied-soft">
                Still open: {report.missing.join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Button asChild size="sm" variant="solid">
              <Link href={reportHref}>{report.saved ? "Open report" : "Start report"}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a
                href={`${letterUrl}/claims/${claim.id}/summary-report`}
                target="_blank"
                rel="noreferrer"
              >
                Open in BLACKLETTER
              </a>
            </Button>
          </div>
        </div>
      </section>

      <ReportDetailsForm claim={claim} {...rest} />

      <div className="grid gap-5 md:grid-cols-2">
        <PacketFiles
          title="Xactimate Sketch"
          empty="Export the sketch from Xactimate as a PDF with “sketch” in the file name and upload it to the Documents Vault."
          docs={sketches}
          claimId={claim.id}
        />
        <PacketFiles
          title="Photo Report"
          empty="Export the Xactimate photo/images report as a PDF (e.g. “Photo Report.pdf”) and upload it to the Documents Vault."
          docs={photoReports}
          claimId={claim.id}
        />
      </div>
    </div>
  );
}

function PacketFiles({
  title,
  empty,
  docs,
  claimId,
}: {
  title: string;
  empty: string;
  docs: Doc[];
  claimId: string;
}) {
  return (
    <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
      <p className="eyebrow">{title}</p>
      {docs.length ? (
        <ul className="mt-3 space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="min-w-0">
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm text-brand-white hover:text-brand-gold"
              >
                {d.fileName}
              </a>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-slate">
                {format(new Date(d.uploadedAt), "MMM d, yyyy")} · {d.uploaderName}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="mt-3 text-sm text-brand-slate">{empty}</p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href={`/claims/${claimId}?tab=documents`}>Go to Documents Vault</Link>
          </Button>
        </>
      )}
    </section>
  );
}
