"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateClaimReportDetailsAction } from "@/lib/actions/claim-workspace";
import {
  MITIGATION_ENGAGED_OPTIONS,
  OCCUPANCY_OPTIONS,
  type ClaimReportDetails,
} from "@/lib/claims/report-details";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { ClaimField } from "@/components/claims/claim-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNSET = "__unset";

type TextKey = {
  [K in keyof ClaimReportDetails]: ClaimReportDetails[K] extends string | null ? K : never;
}[keyof ClaimReportDetails];
type BoolKey = "moldObserved" | "contentsDamaged" | "homeHabitable";
type NumberKey = "stories" | "yearBuilt";

function initDetails(details: ClaimReportDetails): ClaimReportDetails {
  return {
    ...details,
    certifiedPolicyRequestedDate: details.certifiedPolicyRequestedDate?.slice(0, 10) ?? null,
    certifiedPolicyReceivedDate: details.certifiedPolicyReceivedDate?.slice(0, 10) ?? null,
    mitigationStartDate: details.mitigationStartDate?.slice(0, 10) ?? null,
  };
}

export function ReportDetailsForm({ claim, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const canWrite = editable && !claim.isArchived;
  const [details, setDetails] = useState(() => initDetails(claim.reportDetails));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const mitigationContact = claim.contacts.find((c) => c.kind === "MITIGATION");

  function set<K extends keyof ClaimReportDetails>(key: K, value: ClaimReportDetails[K]) {
    setDetails((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setError("");
    setSaving(true);
    const result = await updateClaimReportDetailsAction(claim.id, details);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDirty(false);
    toast.success("Report details saved");
    router.refresh();
  }

  const text = (key: TextKey, label: string, placeholder?: string, className?: string) => (
    <ClaimField label={label} className={className}>
      <Input
        disabled={!canWrite}
        value={details[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </ClaimField>
  );

  const date = (key: TextKey, label: string) => (
    <ClaimField label={label}>
      <Input
        type="date"
        disabled={!canWrite}
        value={details[key] ?? ""}
        onChange={(e) => set(key, e.target.value || null)}
      />
    </ClaimField>
  );

  const number = (key: NumberKey, label: string, placeholder?: string) => (
    <ClaimField label={label}>
      <Input
        type="number"
        inputMode="numeric"
        disabled={!canWrite}
        value={details[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          set(key, Number.isFinite(n) ? n : null);
        }}
      />
    </ClaimField>
  );

  const area = (key: TextKey, label: string, placeholder: string) => (
    <ClaimField label={label} className="sm:col-span-2">
      <Textarea
        rows={3}
        disabled={!canWrite}
        value={details[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </ClaimField>
  );

  const choice = (
    key: TextKey,
    label: string,
    options: ReadonlyArray<{ value: string; label: string }>
  ) => (
    <ClaimField label={label}>
      <Select
        disabled={!canWrite}
        value={details[key] ?? UNSET}
        onValueChange={(v) => set(key, v === UNSET ? null : v)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>Not recorded</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ClaimField>
  );

  const yesNo = (key: BoolKey, label: string, yes: string, no: string) => (
    <ClaimField label={label}>
      <Select
        disabled={!canWrite}
        value={details[key] === null ? UNSET : details[key] ? "yes" : "no"}
        onValueChange={(v) => set(key, v === UNSET ? null : v === "yes")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>Not recorded</SelectItem>
          <SelectItem value="yes">{yes}</SelectItem>
          <SelectItem value="no">{no}</SelectItem>
        </SelectContent>
      </Select>
    </ClaimField>
  );

  const group = (title: string, children: React.ReactNode, note?: React.ReactNode) => (
    <div className="space-y-3">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
        {title}
      </p>
      {note ? <p className="text-xs text-brand-slate">{note}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );

  return (
    <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Report Details</p>
          <p className="mt-2 max-w-2xl text-sm text-brand-slate">
            Facts entered here fill the matching Summary Report sections. Sections you have
            rewritten in the report keep your wording — use “Reset to claim-file draft” there to
            pull in updates.
          </p>
        </div>
        {canWrite ? (
          <Button className="w-full sm:w-auto" size="sm" disabled={saving || !dirty} onClick={save}>
            {saving ? "Saving…" : "Save details"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner className="mt-4" message={error} onDismiss={() => setError("")} />
      ) : null}

      <div className="mt-5 space-y-6">
        {group(
          "Field Assignment",
          <>
            {date("certifiedPolicyRequestedDate", "Certified policy requested")}
            {date("certifiedPolicyReceivedDate", "Certified policy received")}
          </>,
          <>
            Initial contact and inspection dates come from the{" "}
            <Link href={`/claims/${claim.id}?tab=dates`} className="text-brand-gold hover:underline">
              Dates
            </Link>{" "}
            tab; the carrier field adjuster and desk adjuster come from{" "}
            <Link href={`/claims/${claim.id}?tab=contacts`} className="text-brand-gold hover:underline">
              Contacts / People
            </Link>
            .
          </>
        )}

        {group(
          "Risk and Occupancy",
          <>
            {text("dwellingType", "Dwelling type", "single-family residence")}
            {choice("occupancy", "Occupancy", OCCUPANCY_OPTIONS)}
            {number("stories", "Stories", "1")}
            {number("yearBuilt", "Year built", "1998")}
            {text("constructionType", "Construction", "concrete block with a stucco finish")}
            {text("roofCovering", "Roof", "hip roof covered in dimensional asphalt shingles")}
            <p className="text-xs text-brand-slate sm:col-span-2">
              Prints as “The structure is [construction]. The roof is a [roof].”
            </p>
          </>
        )}

        {group(
          "Inspection & Cause of Loss",
          <>
            {text(
              "inspectionAttendees",
              "Present at inspection (besides the PA)",
              "the Insured and the carrier's field adjuster"
            )}
            {text("originOfLoss", "Origin of loss", "Roof assembly above the living room")}
          </>
        )}

        {group(
          "Prior Losses",
          area(
            "priorLosses",
            "Prior losses",
            "Prior claims or damage reported by the insured, prior repairs, and whether they overlap this loss. Leave blank if not yet asked; “N/A” if none."
          )
        )}

        {group(
          "Mold & Contents",
          <>
            {yesNo("moldObserved", "Mold", "Visible mold observed", "No visible mold")}
            {yesNo("contentsDamaged", "Contents", "Personal property damaged", "No contents damage")}
          </>
        )}

        {group(
          "Emergency Mitigation Services (EMS)",
          <>
            {text(
              "mitigationCompany",
              "Mitigation company",
              mitigationContact
                ? mitigationContact.company || mitigationContact.name
                : "ServPro of Downtown Orlando"
            )}
            {choice("mitigationEngagedBy", "Engaged by", MITIGATION_ENGAGED_OPTIONS)}
            {date("mitigationStartDate", "Mitigation started")}
            <div className="hidden sm:block" />
            {area(
              "mitigationServices",
              "Services performed",
              "Tarp, water extraction, drying equipment, contents pack-out, board-up…"
            )}
          </>,
          mitigationContact && !details.mitigationCompany
            ? `If left blank, the report uses the mitigation contact on file: ${
                mitigationContact.company || mitigationContact.name
              }.`
            : undefined
        )}

        {group(
          "Additional Living Expense (ALE)",
          <>
            {yesNo("homeHabitable", "Habitability", "Home is habitable", "Home is not habitable")}
            <div className="hidden sm:block" />
            {area(
              "aleDetails",
              "ALE details",
              "Where the insured is staying, nightly/monthly cost, start date, advances requested."
            )}
          </>
        )}

        {group(
          "Subrogation / Salvage",
          area(
            "subrogationNotes",
            "Subrogation / salvage",
            "Third-party involvement (contractor, manufacturer, neighbor, HOA) or salvage potential. “N/A” if none."
          )
        )}
      </div>

      {canWrite ? (
        <Button className="mt-6 w-full sm:w-auto" size="sm" disabled={saving || !dirty} onClick={save}>
          {saving ? "Saving…" : "Save details"}
        </Button>
      ) : null}
    </section>
  );
}
