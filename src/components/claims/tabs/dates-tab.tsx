"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateClaimDatesAction } from "@/lib/actions/claim-workspace";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { ClaimField } from "@/components/claims/claim-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";

type DatesState = {
  initialContactDate: string;
  scheduledAppointmentDate: string;
  lossInspectedDate: string;
  estimateCreatedDate: string;
  reportCreatedDate: string;
  estimateSentDate: string;
};

function sliceDate(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function initDates(claim: ClaimWorkspaceProps["claim"]): DatesState {
  return {
    initialContactDate: sliceDate(claim.initialContactDate),
    scheduledAppointmentDate: sliceDate(claim.scheduledAppointmentDate),
    lossInspectedDate: sliceDate(claim.lossInspectedDate),
    estimateCreatedDate: sliceDate(claim.estimateCreatedDate),
    reportCreatedDate: sliceDate(claim.reportCreatedDate),
    estimateSentDate: sliceDate(claim.estimateSentDate),
  };
}

export function DatesTab({ claim, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [dates, setDates] = useState(() => initDates(claim));

  async function save() {
    setError("");
    const result = await updateClaimDatesAction(claim.id, {
      initialContactDate: dates.initialContactDate || null,
      scheduledAppointmentDate: dates.scheduledAppointmentDate || null,
      lossInspectedDate: dates.lossInspectedDate || null,
      estimateCreatedDate: dates.estimateCreatedDate || null,
      reportCreatedDate: dates.reportCreatedDate || null,
      estimateSentDate: dates.estimateSentDate || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Claim dates updated");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="border border-brand-white/10 p-5">
        <p className="eyebrow mb-4">Claim Dates</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClaimField label="Initial Contact">
            <Input
              type="date"
              disabled={!editable}
              value={dates.initialContactDate}
              onChange={(e) =>
                setDates({ ...dates, initialContactDate: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="Scheduled Appointment">
            <Input
              type="date"
              disabled={!editable}
              value={dates.scheduledAppointmentDate}
              onChange={(e) =>
                setDates({
                  ...dates,
                  scheduledAppointmentDate: e.target.value,
                })
              }
            />
          </ClaimField>
          <ClaimField label="Loss Inspected">
            <Input
              type="date"
              disabled={!editable}
              value={dates.lossInspectedDate}
              onChange={(e) =>
                setDates({ ...dates, lossInspectedDate: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="Estimate Created">
            <Input
              type="date"
              disabled={!editable}
              value={dates.estimateCreatedDate}
              onChange={(e) =>
                setDates({ ...dates, estimateCreatedDate: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="Report Created">
            <Input
              type="date"
              disabled={!editable}
              value={dates.reportCreatedDate}
              onChange={(e) =>
                setDates({ ...dates, reportCreatedDate: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="Estimate Sent">
            <Input
              type="date"
              disabled={!editable}
              value={dates.estimateSentDate}
              onChange={(e) =>
                setDates({ ...dates, estimateSentDate: e.target.value })
              }
            />
          </ClaimField>
        </div>
        {editable ? (
          <Button className="mt-4" size="sm" variant="outline" onClick={save}>
            Save Dates
          </Button>
        ) : null}
      </section>
    </div>
  );
}
