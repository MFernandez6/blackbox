"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LossType } from "@prisma/client";
import { LOSS_TYPE_LABELS } from "@/lib/claims/labels";
import { updateClaimDetailAction } from "@/lib/actions/claims";
import type { ClaimDetailUpdateInput } from "@/lib/schemas/claim";
import { contingencyForCat } from "@/lib/utils";
import { GoogleMapsButton } from "@/components/claims/google-maps-button";
import { PolicyCoveragePanel } from "@/components/claims/policy-coverage-panel";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { ClaimField } from "@/components/claims/claim-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DetailState = {
  propertyAddress: string;
  zipCode: string;
  county: string;
  lossType: LossType;
  dateOfLoss: string;
  lossDescription: string;
  policyNumber: string;
  carrierName: string;
  insurerClaimNumber: string;
  deskExaminerName: string;
  deskExaminerPhone: string;
  deskExaminerEmail: string;
  fieldAdjusterName: string;
  fieldAdjusterPhone: string;
  fieldAdjusterEmail: string;
  experts: ClaimDetailUpdateInput["experts"];
  estimatedValue: string;
  isCatClaim: boolean;
  assignedAdjusterId: string;
};

function initDetailState(claim: ClaimWorkspaceProps["claim"]): DetailState {
  return {
    propertyAddress: claim.propertyAddress,
    zipCode: claim.zipCode,
    county: claim.county,
    lossType: claim.lossType,
    dateOfLoss: claim.dateOfLoss.slice(0, 10),
    lossDescription: claim.lossDescription ?? "",
    policyNumber: claim.policyNumber ?? "",
    carrierName: claim.carrierName ?? "",
    insurerClaimNumber: claim.insurerClaimNumber ?? "",
    deskExaminerName: claim.deskExaminerName ?? "",
    deskExaminerPhone: claim.deskExaminerPhone ?? "",
    deskExaminerEmail: claim.deskExaminerEmail ?? "",
    fieldAdjusterName: claim.fieldAdjusterName ?? "",
    fieldAdjusterPhone: claim.fieldAdjusterPhone ?? "",
    fieldAdjusterEmail: claim.fieldAdjusterEmail ?? "",
    experts: claim.experts.length ? claim.experts : [],
    estimatedValue: claim.estimatedValue ?? "",
    isCatClaim: claim.isCatClaim,
    assignedAdjusterId: claim.assignedAdjusterId ?? "",
  };
}

function toDetailPayload(detail: DetailState): ClaimDetailUpdateInput {
  return {
    ...detail,
    assignedAdjusterId: detail.assignedAdjusterId || null,
    estimatedValue: detail.estimatedValue || null,
    lossDescription: detail.lossDescription || null,
    policyNumber: detail.policyNumber || null,
    carrierName: detail.carrierName || null,
    insurerClaimNumber: detail.insurerClaimNumber || null,
    deskExaminerName: detail.deskExaminerName || null,
    deskExaminerPhone: detail.deskExaminerPhone || null,
    deskExaminerEmail: detail.deskExaminerEmail || null,
    fieldAdjusterName: detail.fieldAdjusterName || null,
    fieldAdjusterPhone: detail.fieldAdjusterPhone || null,
    fieldAdjusterEmail: detail.fieldAdjusterEmail || null,
    experts: detail.experts.filter((e) => e.name.trim()),
  };
}

export function OverviewTab({ claim, adjusters, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(() => initDetailState(claim));

  async function saveDetail(message: string) {
    setError("");
    const result = await updateClaimDetailAction(claim.id, toDetailPayload(detail));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(message);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="border border-brand-white/10 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Summary</p>
          <GoogleMapsButton
            address={detail.propertyAddress}
            zipCode={detail.zipCode}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClaimField label="Address" className="sm:col-span-2">
            <Input
              disabled={!editable}
              value={detail.propertyAddress}
              onChange={(e) =>
                setDetail({ ...detail, propertyAddress: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="ZIP">
            <Input
              disabled={!editable}
              value={detail.zipCode}
              onChange={(e) => setDetail({ ...detail, zipCode: e.target.value })}
            />
          </ClaimField>
          <ClaimField label="County">
            <Input
              disabled={!editable}
              value={detail.county}
              onChange={(e) => setDetail({ ...detail, county: e.target.value })}
            />
          </ClaimField>
          <ClaimField label="Loss Type">
            <Select
              disabled={!editable}
              value={detail.lossType}
              onValueChange={(v) =>
                setDetail({ ...detail, lossType: v as LossType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOSS_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClaimField>
          <ClaimField label="Date of Loss">
            <Input
              type="date"
              disabled={!editable}
              value={detail.dateOfLoss}
              onChange={(e) =>
                setDetail({ ...detail, dateOfLoss: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="NI Claim #">
            <Input
              disabled={!editable}
              value={detail.insurerClaimNumber}
              onChange={(e) =>
                setDetail({ ...detail, insurerClaimNumber: e.target.value })
              }
              placeholder="Carrier claim number"
            />
          </ClaimField>
          <ClaimField label="Est. Value">
            <Input
              disabled={!editable}
              value={detail.estimatedValue}
              onChange={(e) =>
                setDetail({ ...detail, estimatedValue: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="Assigned Adjuster">
            <Select
              disabled={!editable}
              value={detail.assignedAdjusterId || "none"}
              onValueChange={(v) =>
                setDetail({
                  ...detail,
                  assignedAdjusterId: v === "none" ? "" : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {adjusters.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClaimField>
          <ClaimField label="Description" className="sm:col-span-2">
            <Textarea
              disabled={!editable}
              value={detail.lossDescription}
              onChange={(e) =>
                setDetail({ ...detail, lossDescription: e.target.value })
              }
            />
          </ClaimField>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            disabled={!editable}
            checked={detail.isCatClaim}
            onCheckedChange={(c) =>
              setDetail({ ...detail, isCatClaim: !!c })
            }
          />
          <span className="text-sm">
            CAT claim — contingency {contingencyForCat(detail.isCatClaim)}%
          </span>
        </div>
        {editable ? (
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={() => saveDetail("Summary updated")}
          >
            Save Summary
          </Button>
        ) : null}
      </section>

      <section className="border border-brand-white/10 p-4 sm:p-5">
        <p className="eyebrow mb-4">Policy Details</p>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <ClaimField label="Policy #">
            <Input
              disabled={!editable}
              value={detail.policyNumber}
              onChange={(e) =>
                setDetail({ ...detail, policyNumber: e.target.value })
              }
            />
          </ClaimField>
          <ClaimField label="Carrier">
            <Input
              disabled={!editable}
              value={detail.carrierName}
              onChange={(e) =>
                setDetail({ ...detail, carrierName: e.target.value })
              }
            />
          </ClaimField>
        </div>
        {editable ? (
          <Button
            className="mb-6"
            size="sm"
            variant="outline"
            onClick={() => saveDetail("Policy details updated")}
          >
            Save Policy
          </Button>
        ) : null}

        <PolicyCoveragePanel
          claimId={claim.id}
          editable={editable}
          policyParsedAt={claim.policyParsedAt}
          initial={{
            coverageALimit: claim.coverageALimit ?? "",
            coverageBLimit: claim.coverageBLimit ?? "",
            coverageCLimit: claim.coverageCLimit ?? "",
            coverageDLimit: claim.coverageDLimit ?? "",
            policyExclusions: claim.policyExclusions ?? "",
            policyEndorsements: claim.policyEndorsements ?? "",
            coverageAnalysis: claim.coverageAnalysis ?? "",
            policyNumber: detail.policyNumber,
            carrierName: detail.carrierName,
          }}
          policyDocs={claim.documents
            .filter((d) => d.docType === "POLICY")
            .map((d) => ({
              id: d.id,
              fileName: d.fileName,
              fileUrl: d.fileUrl,
              docType: d.docType,
              uploadedAt: d.uploadedAt,
              extractionStatus: d.extractionStatus,
            }))}
        />
      </section>
    </div>
  );
}
