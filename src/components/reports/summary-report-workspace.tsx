"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { saveSummaryReportAction } from "@/lib/actions/summary-report";
import {
  SUMMARY_HEADER_FIELDS,
  SUMMARY_TEXT_FIELDS,
  initialSectionText,
  renderSummaryReportHtml,
  resolveSummaryReport,
  summaryReportChecklist,
  summaryReportFileName,
  type SummaryHeaderField,
  type SummaryHeaderValues,
  type SummaryReportPayload,
  type SummaryReportStatus,
  type SummaryTextField,
  type SummaryTextValues,
} from "@/lib/reports/summary-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";

type Props = {
  payload: SummaryReportPayload;
  editable: boolean;
  backHref: string;
  siblingHref?: string;
  siblingLabel?: string;
};

type Mode = "preview" | "edit";

export function SummaryReportWorkspace({
  payload,
  editable,
  backHref,
  siblingHref,
  siblingLabel,
}: Props) {
  const router = useRouter();
  const canWrite = editable && !payload.claim.isArchived;
  const [mode, setMode] = useState<Mode>(payload.saved || !canWrite ? "preview" : "edit");
  const [header, setHeader] = useState<Partial<SummaryHeaderValues>>(
    () => ({ ...(payload.saved?.header ?? {}) })
  );
  const [sections, setSections] = useState<SummaryTextValues>(() => initialSectionText(payload));
  const [status, setStatus] = useState<SummaryReportStatus>(payload.saved?.status ?? "DRAFT");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const view = useMemo(
    () => resolveSummaryReport(payload, { header, sections, status }),
    [payload, header, sections, status]
  );
  const html = useMemo(() => renderSummaryReportHtml(view), [view]);
  const checklist = useMemo(() => summaryReportChecklist(view), [view]);
  const done = checklist.filter((c) => c.complete).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function setHeaderValue(key: SummaryHeaderField["key"], value: string) {
    setHeader((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function setSectionValue(key: SummaryTextField["key"], value: string) {
    setSections((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save(nextStatus: SummaryReportStatus = status) {
    setError("");
    setSaving(true);
    const rewritten = Object.fromEntries(
      Object.entries(sections).filter(
        ([key, value]) => value !== payload.auto.sections[key as SummaryTextField["key"]]
      )
    );
    const result = await saveSummaryReportAction(payload.claim.id, {
      header,
      sections: rewritten,
      status: nextStatus,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(nextStatus);
    setDirty(false);
    toast.success(nextStatus === "FINAL" ? "Summary report finalized" : "Summary report saved");
    router.refresh();
  }

  function print() {
    const previous = document.title;
    document.title = summaryReportFileName(payload.claim.claimNumber);
    window.print();
    document.title = previous;
  }

  function jumpTo(key: string) {
    setMode("edit");
    requestAnimationFrame(() => {
      document.getElementById(`sr-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const saved = payload.saved;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4 border-b border-brand-white/10 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Summary Report</p>
            <h1 className="mt-1 break-words font-serif text-lg tracking-wide text-brand-gold sm:text-xl">
              {payload.claim.claimNumber}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-brand-slate sm:text-sm">
              <span
                className={
                  status === "FINAL" ? "font-semibold text-brand-gold" : "text-brand-white/80"
                }
              >
                {status === "FINAL" ? "Final" : "Draft"}
              </span>
              {" · "}
              {saved
                ? `Last saved ${format(new Date(saved.updatedAt), "MMM d, yyyy h:mm a")}${
                    saved.updatedBy ? ` by ${saved.updatedBy}` : ""
                  }${saved.updatedVia === "BLACKLETTER" ? " in BLACKLETTER" : ""}`
                : "Not saved yet — fields below are filled from the claim file"}
              {dirty ? " · Unsaved changes" : ""}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Button asChild size="sm" variant="outline">
              <Link href={backHref}>Back to File</Link>
            </Button>
            {siblingHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={siblingHref} target="_blank" rel="noreferrer">
                  {siblingLabel ?? "Open elsewhere"}
                </a>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
              >
                {mode === "edit" ? "Preview" : "Edit"}
              </Button>
            ) : null}
            {canWrite ? (
              <Button size="sm" disabled={saving} onClick={() => save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
            <Button size="sm" variant="solid" className="col-span-2" onClick={print}>
              Print / Save PDF
            </Button>
          </div>
        </div>

        {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

        <div className="rounded-2xl border border-brand-gold/15 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">
              Review checklist · {done} of {checklist.length} sections complete
            </p>
            {canWrite ? (
              status === "FINAL" ? (
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => save("DRAFT")}>
                  Reopen as draft
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || done < checklist.length}
                  title={done < checklist.length ? "Complete every section first" : undefined}
                  onClick={() => save("FINAL")}
                >
                  Mark final
                </Button>
              )
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {checklist.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => (canWrite ? jumpTo(item.key) : undefined)}
                className={`rounded-full border px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] ${
                  item.complete
                    ? "border-brand-gold/40 text-brand-gold"
                    : "border-denied/50 bg-denied-muted text-denied-soft"
                } ${canWrite ? "cursor-pointer" : "cursor-default"}`}
              >
                {item.complete ? "✓ " : ""}
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === "edit" && canWrite ? (
        <SummaryReportForm
          payload={payload}
          header={header}
          sections={sections}
          onHeader={setHeaderValue}
          onSection={setSectionValue}
        />
      ) : null}

      <div
        className={mode === "edit" && canWrite ? "hidden print:block" : "-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function SummaryReportForm({
  payload,
  header,
  sections,
  onHeader,
  onSection,
}: {
  payload: SummaryReportPayload;
  header: Partial<SummaryHeaderValues>;
  sections: SummaryTextValues;
  onHeader: (key: SummaryHeaderField["key"], value: string) => void;
  onSection: (key: SummaryTextField["key"], value: string) => void;
}) {
  const headerGroup = (group: SummaryHeaderField["group"]) =>
    SUMMARY_HEADER_FIELDS.filter((f) => f.group === group);
  const text = (key: SummaryTextField["key"]) =>
    SUMMARY_TEXT_FIELDS.find((f) => f.key === key) as SummaryTextField;

  const headerInput = (field: SummaryHeaderField) => {
    const auto = payload.auto.header[field.key];
    const override = header[field.key] ?? "";
    return (
      <div key={field.key} className="min-w-0 space-y-1.5">
        <Label>{field.label}</Label>
        <Input
          value={override}
          placeholder={auto || "Not on file — type to add"}
          onChange={(e) => onHeader(field.key, e.target.value)}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-slate">
          {override.trim() ? (
            <button
              type="button"
              className="uppercase text-brand-gold hover:underline"
              onClick={() => onHeader(field.key, "")}
            >
              Use claim file{auto ? `: ${auto}` : ""}
            </button>
          ) : auto ? (
            "From claim file"
          ) : (
            "Not on file"
          )}
        </p>
      </div>
    );
  };

  const textArea = (field: SummaryTextField, showLabel = true) => {
    const auto = payload.auto.sections[field.key];
    const value = sections[field.key];
    return (
      <div key={field.key} className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {showLabel ? <Label>{field.title}</Label> : <span />}
          {auto && auto !== value ? (
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-gold hover:underline"
              onClick={() => onSection(field.key, auto)}
            >
              Reset to claim-file draft
            </button>
          ) : null}
        </div>
        <Textarea
          rows={field.rows}
          value={value}
          placeholder={field.hint}
          onChange={(e) => onSection(field.key, e.target.value)}
        />
        <p className="text-xs text-brand-slate">{field.hint}</p>
      </div>
    );
  };

  const panel = (id: string, title: string, children: React.ReactNode) => (
    <section id={`sr-${id}`} className="min-w-0 scroll-mt-28 rounded-2xl border border-brand-gold/15 p-3 sm:p-5">
      <p className="eyebrow mb-4">{title}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );

  return (
    <div className="no-print space-y-5">
      {panel(
        "assignment",
        "Field Assignment",
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {headerGroup("report").map(headerInput)}
            {headerGroup("assignment").map(headerInput)}
          </div>
          {textArea(text("assignmentNotes"))}
        </>
      )}
      {panel(
        "coverage",
        "Coverage",
        <>
          <div className="grid gap-3 sm:grid-cols-2">{headerGroup("coverage").map(headerInput)}</div>
          <p className="eyebrow">Limits of Liability</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {headerGroup("limits").map(headerInput)}
          </div>
          {payload.auto.otherPolicies.length ? (
            <div className="rounded-2xl border border-brand-white/10 p-3">
              <p className="eyebrow mb-2">Other policies on file (printed automatically)</p>
              <ul className="space-y-1.5 text-sm text-brand-white/85">
                {payload.auto.otherPolicies.map((p, i) => (
                  <li key={`${p.title}-${i}`} className="break-words">
                    <span className="text-brand-white">{p.title}</span>
                    {p.detail ? <span className="text-brand-slate"> — {p.detail}</span> : null}
                    {p.limits.length ? (
                      <span className="block font-mono text-[11px] text-brand-slate">
                        {p.limits.map((l) => `${l.label}: ${l.amount}`).join(" · ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-brand-slate">
              Add umbrella, flood, or other policies in Coverage Protocol and they will be listed here
              so no line of coverage is missed.
            </p>
          )}
        </>
      )}
      {panel("riskOccupancy", "Risk and Occupancy Description", textArea(text("riskOccupancy"), false))}
      {panel("inspection", "Inspection", textArea(text("inspection"), false))}
      {panel(
        "causeOfLoss",
        "Cause of Loss",
        <>
          {textArea(text("causeOfLoss"))}
          <div className="grid gap-3 sm:grid-cols-2">
            {textArea(text("causeOfLossStatement"))}
            {textArea(text("originOfLoss"))}
          </div>
        </>
      )}
      {panel("recommendations", "Field Adjuster Recommendation(s)", textArea(text("recommendations"), false))}
      {panel("riskAlert", "Risk Alert", textArea(text("riskAlert"), false))}
      {panel("damages", "Damage(s)", textArea(text("damages"), false))}
      {panel("nonRelatedDamage", "Non-Related Damage", textArea(text("nonRelatedDamage"), false))}
      {panel("priorLosses", "Prior Losses", textArea(text("priorLosses"), false))}
      {panel("mold", "Mold", textArea(text("mold"), false))}
      {panel("contents", "Contents", textArea(text("contents"), false))}
      {panel("ems", "Emergency Mitigation Services (EMS)", textArea(text("ems"), false))}
      {panel("ale", "Additional Living Expense (ALE)", textArea(text("ale"), false))}
      {panel("subrogation", "Subrogation / Salvage", textArea(text("subrogation"), false))}
    </div>
  );
}
