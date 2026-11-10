"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateClaimComplianceAction } from "@/lib/actions/compliance";
import {
  computeFeeCap,
  contractComplianceFlags,
  rescissionDeadline,
  FL_PA_RULES_REVIEWED,
} from "@/lib/compliance/florida-pa";
import type { ClaimComplianceData } from "@/components/claims/claim-detail-types";
import { ClaimField } from "@/components/claims/claim-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__none__";

type Props = {
  claimId: string;
  dateOfLoss: string;
  isCatClaim: boolean;
  feePercent: string;
  compliance: ClaimComplianceData;
  editable: boolean;
};

function day(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function CompliancePanel({ claimId, dateOfLoss, isCatClaim, feePercent, compliance, editable }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(() => ({
    isCatClaim: isCatClaim || !!compliance.emergencyDeclarationId,
    emergencyDeclarationId: compliance.emergencyDeclarationId ?? "",
    claimReportedDate: day(compliance.claimReportedDate),
    isReopenedClaim: compliance.isReopenedClaim,
    priorInsurerPayments: compliance.priorInsurerPayments ?? "",
    contractExecutedDate: day(compliance.contractExecutedDate),
    contractSentToInsurerDate: day(compliance.contractSentToInsurerDate),
    contractCancelledDate: day(compliance.contractCancelledDate),
  }));

  const declaration = compliance.declarations.find((d) => d.id === state.emergencyDeclarationId) ?? null;
  const isEmergencyLoss = state.isCatClaim || !!declaration;

  const cap = useMemo(
    () =>
      computeFeeCap({
        isEmergencyLoss,
        emergencyDeclaredDate: declaration?.declaredDate ?? null,
        claimReportedDate: state.claimReportedDate || null,
        isReopenedClaim: state.isReopenedClaim,
      }),
    [isEmergencyLoss, declaration?.declaredDate, state.claimReportedDate, state.isReopenedClaim]
  );
  const rescission = rescissionDeadline({
    contractExecutedDate: state.contractExecutedDate || null,
    dateOfLoss,
    isEmergencyLoss: cap.emergencyCapApplies,
  });
  const flags = contractComplianceFlags({
    contractExecutedDate: state.contractExecutedDate || null,
    contractCancelledDate: state.contractCancelledDate || null,
    contractSentToInsurerDate: state.contractSentToInsurerDate || null,
    dateOfLoss,
    isEmergencyLoss: cap.emergencyCapApplies,
  });

  async function save() {
    setError("");
    setSaving(true);
    const result = await updateClaimComplianceAction(claimId, {
      ...state,
      emergencyDeclarationId: state.emergencyDeclarationId || null,
      priorInsurerPayments: state.priorInsurerPayments || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Compliance saved · fee cap ${result.data.capPercent}%`);
    router.refresh();
  }

  const set = <K extends keyof typeof state>(key: K, value: (typeof state)[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  return (
    <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">PA contract &amp; fee compliance</p>
          <p className="mt-1 text-xs text-brand-slate">
            Florida public adjuster rules · {FL_PA_RULES_REVIEWED.toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl font-bold text-brand-gold">{cap.capPercent}%</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-slate">
            Fee cap · on file {feePercent}%
          </p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" /> : null}

      <p className="mb-4 text-sm text-brand-white/80">
        {cap.basis} <span className="text-brand-slate">({cap.cite})</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            disabled={!editable}
            checked={state.isCatClaim}
            onCheckedChange={(c) => set("isCatClaim", !!c)}
          />
          <span className="text-sm">Loss arises from a Governor-declared state of emergency</span>
        </label>
        <ClaimField label="Emergency declaration">
          <Select
            disabled={!editable}
            value={state.emergencyDeclarationId || NONE}
            onValueChange={(v) => {
              const id = v === NONE ? "" : v;
              setState((s) => ({ ...s, emergencyDeclarationId: id, isCatClaim: id ? true : s.isCatClaim }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Not linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not linked</SelectItem>
              {compliance.declarations.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                  {d.executiveOrder ? ` · EO ${d.executiveOrder}` : ""} · {d.declaredDate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ClaimField>
        <ClaimField label="Claim reported to insurer">
          <Input
            type="date"
            disabled={!editable}
            value={state.claimReportedDate}
            onChange={(e) => set("claimReportedDate", e.target.value)}
          />
        </ClaimField>
        <label className="flex items-center gap-2">
          <Checkbox
            disabled={!editable}
            checked={state.isReopenedClaim}
            onCheckedChange={(c) => set("isReopenedClaim", !!c)}
          />
          <span className="text-sm">Reopened or supplemental claim</span>
        </label>
        <ClaimField label="Insurer payments before contract ($)">
          <Input
            inputMode="decimal"
            disabled={!editable}
            value={state.priorInsurerPayments}
            onChange={(e) => set("priorInsurerPayments", e.target.value)}
            placeholder="Excluded from the fee base"
          />
        </ClaimField>
        <ClaimField label="PA contract executed">
          <Input
            type="date"
            disabled={!editable}
            value={state.contractExecutedDate}
            onChange={(e) => set("contractExecutedDate", e.target.value)}
          />
        </ClaimField>
        <ClaimField label="Executed contract sent to insurer">
          <Input
            type="date"
            disabled={!editable}
            value={state.contractSentToInsurerDate}
            onChange={(e) => set("contractSentToInsurerDate", e.target.value)}
          />
        </ClaimField>
        <ClaimField label="Cancelled by insured">
          <Input
            type="date"
            disabled={!editable}
            value={state.contractCancelledDate}
            onChange={(e) => set("contractCancelledDate", e.target.value)}
          />
        </ClaimField>
        {rescission ? (
          <div className="rounded-xl border border-brand-white/10 p-3 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-slate">
              Rescission deadline
            </p>
            <p className="mt-1 font-semibold">{rescission.deadline.toISOString().slice(0, 10)}</p>
            <p className="text-xs text-brand-slate">
              {rescission.basis} ({rescission.cite})
            </p>
          </div>
        ) : null}
      </div>

      {[...cap.warnings.map((m) => ({ level: "warn" as const, message: m })), ...flags].length ? (
        <ul className="mt-4 space-y-1.5">
          {[...cap.warnings.map((m) => ({ level: "warn" as const, message: m })), ...flags].map((f) => (
            <li
              key={f.message}
              className={cn(
                "rounded-md px-3 py-2 text-xs",
                f.level === "block" && "bg-denied/10 text-denied",
                f.level === "warn" && "bg-brand-gold/10 text-brand-gold",
                f.level === "info" && "bg-brand-white/5 text-brand-white/80"
              )}
            >
              {f.message}
            </li>
          ))}
        </ul>
      ) : null}

      {editable ? (
        <Button className="mt-4" size="sm" variant="outline" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save Compliance"}
        </Button>
      ) : null}
    </section>
  );
}
