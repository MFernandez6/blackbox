"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type {
  ClaimStatus,
  LossType,
  DocType,
  PaymentType,
  PreferredContactMethod,
  AdjusterRole,
} from "@prisma/client";
import {
  STATUS_LABELS,
  LOSS_TYPE_LABELS,
  DOC_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  CONTACT_METHOD_LABELS,
} from "@/lib/claims/labels";
import { canEdit, canManagePayments } from "@/lib/auth-client";
import { formatCurrency, contingencyForCat } from "@/lib/utils";
import {
  changeClaimStatusAction,
  archiveClaimAction,
  updateClaimDetailAction,
  updateClaimantsAction,
  createPaymentAction,
} from "@/lib/actions/claims";
import { StatusBadge } from "@/components/claims/status-badge";
import { DocumentUploadDialog } from "@/components/claims/document-upload-dialog";
import { GoogleMapsButton } from "@/components/claims/google-maps-button";
import { PolicyCoveragePanel } from "@/components/claims/policy-coverage-panel";
import type { CarrierExpertInput } from "@/lib/schemas/claim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

export type ClaimDetailData = {
  id: string;
  claimNumber: string;
  insurerClaimNumber: string | null;
  status: ClaimStatus;
  lossType: LossType;
  dateOfLoss: string;
  propertyAddress: string;
  zipCode: string;
  county: string;
  lossDescription: string | null;
  policyNumber: string | null;
  carrierName: string | null;
  deskExaminerName: string | null;
  deskExaminerPhone: string | null;
  deskExaminerEmail: string | null;
  fieldAdjusterName: string | null;
  fieldAdjusterPhone: string | null;
  fieldAdjusterEmail: string | null;
  experts: CarrierExpertInput[];
  coverageALimit: string | null;
  coverageBLimit: string | null;
  coverageCLimit: string | null;
  coverageDLimit: string | null;
  policyExclusions: string | null;
  policyEndorsements: string | null;
  coverageAnalysis: string | null;
  policyParsedAt: string | null;
  estimatedValue: string | null;
  isCatClaim: boolean;
  contingencyFeePercent: string;
  assignedAdjusterId: string | null;
  isArchived: boolean;
  createdAt: string;
  claimants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    mailingAddress: string;
    preferredContactMethod: PreferredContactMethod;
    isPrimaryContact: boolean;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: ClaimStatus | null;
    newStatus: ClaimStatus;
    changedAt: string;
    note: string | null;
    changedByName: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    docType: DocType;
    uploadedAt: string;
    uploaderName: string;
    extractionStatus: string;
    // AI_HOOK: display extractedData fields
    // here once populated (policy number, date of loss, claimant name cross-check)
  }>;
  payments: Array<{
    id: string;
    type: PaymentType;
    amount: string;
    date: string;
    note: string | null;
    recordedByName: string;
  }>;
};

type AdjusterOption = { id: string; name: string };

type Props = {
  claim: ClaimDetailData;
  adjusters: AdjusterOption[];
  role: AdjusterRole;
};

export function ClaimDetailClient({ claim, adjusters, role }: Props) {
  const router = useRouter();
  const editable = canEdit(role);
  const paymentsOk = canManagePayments(role);
  const [error, setError] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ClaimStatus>(claim.status);
  const [statusNote, setStatusNote] = useState("");

  const [property, setProperty] = useState({
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
    estimatedValue: claim.estimatedValue ?? "",
    isCatClaim: claim.isCatClaim,
    assignedAdjusterId: claim.assignedAdjusterId ?? "",
  });

  const [experts, setExperts] = useState<CarrierExpertInput[]>(
    claim.experts.length
      ? claim.experts
      : []
  );

  const [claimants, setClaimants] = useState(claim.claimants);

  async function saveProperty() {
    setError("");
    const result = await updateClaimDetailAction(claim.id, {
      ...property,
      assignedAdjusterId: property.assignedAdjusterId || null,
      estimatedValue: property.estimatedValue || null,
      lossDescription: property.lossDescription || null,
      policyNumber: property.policyNumber || null,
      carrierName: property.carrierName || null,
      insurerClaimNumber: property.insurerClaimNumber || null,
      deskExaminerName: property.deskExaminerName || null,
      deskExaminerPhone: property.deskExaminerPhone || null,
      deskExaminerEmail: property.deskExaminerEmail || null,
      fieldAdjusterName: property.fieldAdjusterName || null,
      fieldAdjusterPhone: property.fieldAdjusterPhone || null,
      fieldAdjusterEmail: property.fieldAdjusterEmail || null,
      experts: experts.filter((e) => e.name.trim()),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Property record updated");
    router.refresh();
  }

  async function saveClaimants() {
    setError("");
    const result = await updateClaimantsAction(claim.id, claimants);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Claimant record updated");
    router.refresh();
  }

  async function submitStatus() {
    setError("");
    const result = await changeClaimStatusAction(claim.id, {
      newStatus,
      note: statusNote,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Status change logged");
    setStatusOpen(false);
    setStatusNote("");
    router.refresh();
  }

  async function archive() {
    if (!confirm("Archive this file? Related records will be retained.")) return;
    const result = await archiveClaimAction(claim.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("File archived — record sealed");
    router.push("/dashboard");
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-white/10 pb-6">
        <div>
          <p className="eyebrow">Secure Record</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div>
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                BL Claim #
              </p>
              <h1 className="font-mono text-2xl tracking-wide text-brand-gold">
                {claim.claimNumber}
              </h1>
            </div>
            <div>
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                NI Claim #
              </p>
              <p className="font-mono text-lg tracking-wide text-brand-white">
                {claim.insurerClaimNumber || "—"}
              </p>
            </div>
            <StatusBadge status={claim.status} />
            {claim.isCatClaim ? (
              <Badge className="border-brand-white/10 text-brand-slate">CAT</Badge>
            ) : null}
            {claim.isArchived ? (
              <Badge className="border-denied text-denied">Archived</Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-brand-slate">
            Assigned:{" "}
            {adjusters.find((a) => a.id === claim.assignedAdjusterId)?.name ??
              "Unassigned"}{" "}
            · Fee {claim.contingencyFeePercent}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GoogleMapsButton
            address={property.propertyAddress || claim.propertyAddress}
            zipCode={property.zipCode || claim.zipCode}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/claims/${claim.id}/documents`}>Document Vault</Link>
          </Button>
          {editable && !claim.isArchived ? (
            <>
              <Button size="sm" onClick={() => setStatusOpen(true)}>
                Change Status
              </Button>
              <Button size="sm" variant="destructive" onClick={archive}>
                Archive
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Main column */}
        <div className="space-y-8 lg:col-span-3">
          {/* Claimants */}
          <section className="border border-brand-white/10 p-5">
            <p className="eyebrow mb-4">Claimant Info</p>
            <div className="space-y-6">
              {claimants.map((c, i) => (
                <div key={c.id || i} className="space-y-3 border-t border-brand-white/10 pt-4 first:border-0 first:pt-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="First">
                      <Input
                        disabled={!editable}
                        value={c.firstName}
                        onChange={(e) => {
                          const next = [...claimants];
                          next[i] = { ...c, firstName: e.target.value };
                          setClaimants(next);
                        }}
                      />
                    </Field>
                    <Field label="Last">
                      <Input
                        disabled={!editable}
                        value={c.lastName}
                        onChange={(e) => {
                          const next = [...claimants];
                          next[i] = { ...c, lastName: e.target.value };
                          setClaimants(next);
                        }}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        disabled={!editable}
                        value={c.email}
                        onChange={(e) => {
                          const next = [...claimants];
                          next[i] = { ...c, email: e.target.value };
                          setClaimants(next);
                        }}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        disabled={!editable}
                        value={c.phone}
                        onChange={(e) => {
                          const next = [...claimants];
                          next[i] = { ...c, phone: e.target.value };
                          setClaimants(next);
                        }}
                      />
                    </Field>
                    <Field label="Mailing" className="sm:col-span-2">
                      <Input
                        disabled={!editable}
                        value={c.mailingAddress}
                        onChange={(e) => {
                          const next = [...claimants];
                          next[i] = { ...c, mailingAddress: e.target.value };
                          setClaimants(next);
                        }}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Select
                      disabled={!editable}
                      value={c.preferredContactMethod}
                      onValueChange={(v) => {
                        const next = [...claimants];
                        next[i] = {
                          ...c,
                          preferredContactMethod: v as PreferredContactMethod,
                        };
                        setClaimants(next);
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTACT_METHOD_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        disabled={!editable}
                        checked={c.isPrimaryContact}
                        onCheckedChange={(checked) => {
                          setClaimants(
                            claimants.map((row, j) => ({
                              ...row,
                              isPrimaryContact: j === i ? !!checked : false,
                            }))
                          );
                        }}
                      />
                      Primary
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {editable ? (
              <Button className="mt-4" size="sm" variant="outline" onClick={saveClaimants}>
                Save Claimants
              </Button>
            ) : null}
          </section>

          {/* Property */}
          <section className="border border-brand-white/10 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">Property & Loss</p>
              <GoogleMapsButton
                address={property.propertyAddress}
                zipCode={property.zipCode}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Address" className="sm:col-span-2">
                <Input
                  disabled={!editable}
                  value={property.propertyAddress}
                  onChange={(e) =>
                    setProperty({ ...property, propertyAddress: e.target.value })
                  }
                />
              </Field>
              <Field label="ZIP">
                <Input
                  disabled={!editable}
                  value={property.zipCode}
                  onChange={(e) =>
                    setProperty({ ...property, zipCode: e.target.value })
                  }
                />
              </Field>
              <Field label="County">
                <Input
                  disabled={!editable}
                  value={property.county}
                  onChange={(e) =>
                    setProperty({ ...property, county: e.target.value })
                  }
                />
              </Field>
              <Field label="Loss Type">
                <Select
                  disabled={!editable}
                  value={property.lossType}
                  onValueChange={(v) =>
                    setProperty({ ...property, lossType: v as LossType })
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
              </Field>
              <Field label="Date of Loss">
                <Input
                  type="date"
                  disabled={!editable}
                  value={property.dateOfLoss}
                  onChange={(e) =>
                    setProperty({ ...property, dateOfLoss: e.target.value })
                  }
                />
              </Field>
              <Field label="Policy #">
                <Input
                  disabled={!editable}
                  value={property.policyNumber}
                  onChange={(e) =>
                    setProperty({ ...property, policyNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Carrier">
                <Input
                  disabled={!editable}
                  value={property.carrierName}
                  onChange={(e) =>
                    setProperty({ ...property, carrierName: e.target.value })
                  }
                />
              </Field>
              <Field label="NI Claim #">
                <Input
                  disabled={!editable}
                  value={property.insurerClaimNumber}
                  onChange={(e) =>
                    setProperty({
                      ...property,
                      insurerClaimNumber: e.target.value,
                    })
                  }
                  placeholder="Carrier claim number"
                />
              </Field>
              <Field label="Est. Value">
                <Input
                  disabled={!editable}
                  value={property.estimatedValue}
                  onChange={(e) =>
                    setProperty({ ...property, estimatedValue: e.target.value })
                  }
                />
              </Field>
              <Field label="Assigned Adjuster">
                <Select
                  disabled={!editable}
                  value={property.assignedAdjusterId || "none"}
                  onValueChange={(v) =>
                    setProperty({
                      ...property,
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
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  disabled={!editable}
                  value={property.lossDescription}
                  onChange={(e) =>
                    setProperty({ ...property, lossDescription: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Checkbox
                disabled={!editable}
                checked={property.isCatClaim}
                onCheckedChange={(c) =>
                  setProperty({ ...property, isCatClaim: !!c })
                }
              />
              <span className="text-sm">
                CAT claim — contingency {contingencyForCat(property.isCatClaim)}%
              </span>
            </div>
          </section>

          {/* Carrier contacts */}
          <section className="border border-brand-white/10 p-5">
            <p className="eyebrow mb-4">Carrier Contacts</p>
            <div className="space-y-6">
              <div>
                <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                  Desk Examiner
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name">
                    <Input
                      disabled={!editable}
                      value={property.deskExaminerName}
                      onChange={(e) =>
                        setProperty({
                          ...property,
                          deskExaminerName: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      disabled={!editable}
                      value={property.deskExaminerPhone}
                      onChange={(e) =>
                        setProperty({
                          ...property,
                          deskExaminerPhone: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      disabled={!editable}
                      value={property.deskExaminerEmail}
                      onChange={(e) =>
                        setProperty({
                          ...property,
                          deskExaminerEmail: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="border-t border-brand-white/10 pt-4">
                <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                  Field Adjuster
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name">
                    <Input
                      disabled={!editable}
                      value={property.fieldAdjusterName}
                      onChange={(e) =>
                        setProperty({
                          ...property,
                          fieldAdjusterName: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      disabled={!editable}
                      value={property.fieldAdjusterPhone}
                      onChange={(e) =>
                        setProperty({
                          ...property,
                          fieldAdjusterPhone: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      disabled={!editable}
                      value={property.fieldAdjusterEmail}
                      onChange={(e) =>
                        setProperty({
                          ...property,
                          fieldAdjusterEmail: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="border-t border-brand-white/10 pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                    Expert(s)
                  </p>
                  {editable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExperts([
                          ...experts,
                          {
                            name: "",
                            firm: "",
                            specialty: "",
                            phone: "",
                            email: "",
                          },
                        ])
                      }
                    >
                      Add Expert
                    </Button>
                  ) : null}
                </div>
                {experts.length === 0 ? (
                  <p className="text-sm text-brand-slate">No experts on file</p>
                ) : (
                  <div className="space-y-4">
                    {experts.map((ex, i) => (
                      <div
                        key={i}
                        className="grid gap-3 border border-brand-white/10 p-3 sm:grid-cols-2"
                      >
                        <Field label="Name">
                          <Input
                            disabled={!editable}
                            value={ex.name}
                            onChange={(e) => {
                              const next = [...experts];
                              next[i] = { ...ex, name: e.target.value };
                              setExperts(next);
                            }}
                          />
                        </Field>
                        <Field label="Firm">
                          <Input
                            disabled={!editable}
                            value={ex.firm ?? ""}
                            onChange={(e) => {
                              const next = [...experts];
                              next[i] = { ...ex, firm: e.target.value };
                              setExperts(next);
                            }}
                          />
                        </Field>
                        <Field label="Specialty">
                          <Input
                            disabled={!editable}
                            value={ex.specialty ?? ""}
                            onChange={(e) => {
                              const next = [...experts];
                              next[i] = { ...ex, specialty: e.target.value };
                              setExperts(next);
                            }}
                          />
                        </Field>
                        <Field label="Phone">
                          <Input
                            disabled={!editable}
                            value={ex.phone ?? ""}
                            onChange={(e) => {
                              const next = [...experts];
                              next[i] = { ...ex, phone: e.target.value };
                              setExperts(next);
                            }}
                          />
                        </Field>
                        <Field label="Email" className="sm:col-span-2">
                          <Input
                            disabled={!editable}
                            value={ex.email ?? ""}
                            onChange={(e) => {
                              const next = [...experts];
                              next[i] = { ...ex, email: e.target.value };
                              setExperts(next);
                            }}
                          />
                        </Field>
                        {editable ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="sm:col-span-2 justify-self-start"
                            onClick={() =>
                              setExperts(experts.filter((_, j) => j !== i))
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {editable ? (
              <Button className="mt-4" size="sm" variant="outline" onClick={saveProperty}>
                Save Property & Carrier
              </Button>
            ) : null}
          </section>

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
              policyNumber: claim.policyNumber ?? "",
              carrierName: claim.carrierName ?? "",
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

          {/* Documents */}
          <section className="border border-brand-white/10 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="eyebrow">Documents on File</p>
              {editable ? (
                <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                  Upload Document
                </Button>
              ) : null}
            </div>
            {/* AI_HOOK: display extractedData fields
                here once populated (policy number, date of loss, claimant name cross-check) */}
            {claim.documents.length === 0 ? (
              <p className="text-sm text-brand-slate">No documents on file</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-white/10 text-left">
                    <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      File
                    </th>
                    <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      Type
                    </th>
                    <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      By
                    </th>
                    <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {claim.documents.map((d) => (
                    <tr key={d.id} className="border-b border-brand-white/10 last:border-0">
                      <td className="py-2">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-white hover:underline"
                        >
                          {d.fileName}
                        </a>
                      </td>
                      <td className="py-2 font-mono text-xs text-brand-slate">
                        {DOC_TYPE_LABELS[d.docType]}
                      </td>
                      <td className="py-2 text-brand-slate">{d.uploaderName}</td>
                      <td className="py-2 font-mono text-xs text-brand-slate">
                        {format(new Date(d.uploadedAt), "yyyy-MM-dd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Payments — ADMIN */}
          {paymentsOk ? (
            <PaymentPanel claimId={claim.id} payments={claim.payments} />
          ) : null}
        </div>

        {/* Timeline */}
        <aside className="lg:col-span-2">
          <section className="border border-brand-white/10 p-5">
            <p className="eyebrow mb-4">Status Timeline</p>
            <p className="mb-4 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Chain of custody: unbroken
            </p>
            <ol className="space-y-0">
              {claim.statusHistory.map((h, i) => (
                <li
                  key={h.id}
                  className="relative border-l border-brand-white/10 pl-4 pb-6 last:pb-0"
                >
                  <span className="absolute -left-[3px] top-1 h-1.5 w-1.5 bg-brand-gold" />
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                    {format(new Date(h.changedAt), "yyyy-MM-dd HH:mm")}
                  </p>
                  <p className="mt-1 text-sm text-brand-white">
                    {h.previousStatus
                      ? `${STATUS_LABELS[h.previousStatus]} → ${STATUS_LABELS[h.newStatus]}`
                      : STATUS_LABELS[h.newStatus]}
                  </p>
                  <p className="text-xs text-brand-slate">{h.changedByName}</p>
                  {h.note ? (
                    <p className="mt-1 text-sm text-brand-white/80">{h.note}</p>
                  ) : null}
                  {i === 0 && claim.statusHistory.length === 1 ? null : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow">Claim Status</p>
            <DialogTitle>Change Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="New Status">
              <Select
                value={newStatus}
                onValueChange={(v) => setNewStatus(v as ClaimStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note (required)">
              <Textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Reason for status change"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitStatus}>Log Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentUploadDialog
        claimId={claim.id}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PaymentPanel({
  claimId,
  payments,
}: {
  claimId: string;
  payments: ClaimDetailData["payments"];
}) {
  const router = useRouter();
  const [type, setType] = useState<PaymentType>("ADVANCE");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function add() {
    setError("");
    const result = await createPaymentAction({
      claimId,
      type,
      amount: Number(amount),
      date,
      note: note || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Payment recorded");
    setAmount("");
    setNote("");
    router.refresh();
  }

  return (
    <section className="border border-brand-white/10 p-5">
      <p className="eyebrow mb-4">Payment Log — Admin</p>
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" />
      ) : null}
      {payments.length === 0 ? (
        <p className="mb-4 text-sm text-brand-slate">No payments recorded</p>
      ) : (
        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b border-brand-white/10 text-left">
              <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Type
              </th>
              <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Amount
              </th>
              <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Date
              </th>
              <th className="pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                By
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-brand-white/10 last:border-0">
                <td className="py-2 font-mono text-xs">
                  {PAYMENT_TYPE_LABELS[p.type]}
                </td>
                <td className="py-2 font-mono text-xs">
                  {formatCurrency(p.amount)}
                </td>
                <td className="py-2 font-mono text-xs text-brand-slate">
                  {format(new Date(p.date), "yyyy-MM-dd")}
                </td>
                <td className="py-2 text-brand-slate">{p.recordedByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <Select value={type} onValueChange={(v) => setType(v as PaymentType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button className="mt-3" size="sm" variant="outline" onClick={add}>
        Record Payment
      </Button>
    </section>
  );
}
