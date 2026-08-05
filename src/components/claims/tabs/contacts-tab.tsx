"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ContactKind, PreferredContactMethod } from "@prisma/client";
import { CONTACT_KIND_LABELS, CONTACT_METHOD_LABELS } from "@/lib/claims/labels";
import { updateClaimDetailAction, updateClaimantsAction } from "@/lib/actions/claims";
import {
  createClaimContactAction,
  deleteClaimContactAction,
} from "@/lib/actions/claim-workspace";
import type { CarrierExpertInput, ClaimDetailUpdateInput } from "@/lib/schemas/claim";
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
  lossType: ClaimDetailUpdateInput["lossType"];
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
    estimatedValue: claim.estimatedValue ?? "",
    isCatClaim: claim.isCatClaim,
    assignedAdjusterId: claim.assignedAdjusterId ?? "",
  };
}

function toDetailPayload(
  detail: DetailState,
  experts: CarrierExpertInput[]
): ClaimDetailUpdateInput {
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
    experts: experts.filter((e) => e.name.trim()),
  };
}

export function ContactsTab({ claim, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [claimants, setClaimants] = useState(claim.claimants);
  const [detail, setDetail] = useState(() => initDetailState(claim));
  const [experts, setExperts] = useState<CarrierExpertInput[]>(
    claim.experts.length ? claim.experts : []
  );

  const [vendorKind, setVendorKind] = useState<ContactKind>("VENDOR");
  const [vendorName, setVendorName] = useState("");
  const [vendorCompany, setVendorCompany] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorNotes, setVendorNotes] = useState("");

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

  async function saveCarrier() {
    setError("");
    const result = await updateClaimDetailAction(
      claim.id,
      toDetailPayload(detail, experts)
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Carrier contacts updated");
    router.refresh();
  }

  async function addVendor() {
    setError("");
    const result = await createClaimContactAction({
      claimId: claim.id,
      kind: vendorKind,
      name: vendorName,
      company: vendorCompany || null,
      phone: vendorPhone || null,
      email: vendorEmail || null,
      notes: vendorNotes || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Contact added");
    setVendorName("");
    setVendorCompany("");
    setVendorPhone("");
    setVendorEmail("");
    setVendorNotes("");
    router.refresh();
  }

  async function removeVendor(id: string) {
    if (!confirm("Remove this contact from the file?")) return;
    setError("");
    const result = await deleteClaimContactAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Contact removed");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="border border-brand-white/10 p-4 sm:p-5">
        <p className="eyebrow mb-4">Claimants</p>
        <div className="space-y-6">
          {claimants.map((c, i) => (
            <div
              key={c.id || i}
              className="space-y-3 border-t border-brand-white/10 pt-4 first:border-0 first:pt-0"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ClaimField label="First">
                  <Input
                    disabled={!editable}
                    value={c.firstName}
                    onChange={(e) => {
                      const next = [...claimants];
                      next[i] = { ...c, firstName: e.target.value };
                      setClaimants(next);
                    }}
                  />
                </ClaimField>
                <ClaimField label="Last">
                  <Input
                    disabled={!editable}
                    value={c.lastName}
                    onChange={(e) => {
                      const next = [...claimants];
                      next[i] = { ...c, lastName: e.target.value };
                      setClaimants(next);
                    }}
                  />
                </ClaimField>
                <ClaimField label="Email">
                  <Input
                    disabled={!editable}
                    value={c.email}
                    onChange={(e) => {
                      const next = [...claimants];
                      next[i] = { ...c, email: e.target.value };
                      setClaimants(next);
                    }}
                  />
                </ClaimField>
                <ClaimField label="Phone">
                  <Input
                    disabled={!editable}
                    value={c.phone}
                    onChange={(e) => {
                      const next = [...claimants];
                      next[i] = { ...c, phone: e.target.value };
                      setClaimants(next);
                    }}
                  />
                </ClaimField>
                <ClaimField label="Mailing" className="sm:col-span-2">
                  <Input
                    disabled={!editable}
                    value={c.mailingAddress}
                    onChange={(e) => {
                      const next = [...claimants];
                      next[i] = { ...c, mailingAddress: e.target.value };
                      setClaimants(next);
                    }}
                  />
                </ClaimField>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
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
                  <SelectTrigger className="w-full sm:w-40">
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

      <section className="border border-brand-white/10 p-4 sm:p-5">
        <p className="eyebrow mb-4">Carrier Contacts</p>
        <div className="space-y-6">
          <div>
            <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              Desk Examiner
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <ClaimField label="Name">
                <Input
                  disabled={!editable}
                  value={detail.deskExaminerName}
                  onChange={(e) =>
                    setDetail({ ...detail, deskExaminerName: e.target.value })
                  }
                />
              </ClaimField>
              <ClaimField label="Phone">
                <Input
                  disabled={!editable}
                  value={detail.deskExaminerPhone}
                  onChange={(e) =>
                    setDetail({ ...detail, deskExaminerPhone: e.target.value })
                  }
                />
              </ClaimField>
              <ClaimField label="Email">
                <Input
                  disabled={!editable}
                  value={detail.deskExaminerEmail}
                  onChange={(e) =>
                    setDetail({ ...detail, deskExaminerEmail: e.target.value })
                  }
                />
              </ClaimField>
            </div>
          </div>
          <div className="border-t border-brand-white/10 pt-4">
            <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              Field Adjuster
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <ClaimField label="Name">
                <Input
                  disabled={!editable}
                  value={detail.fieldAdjusterName}
                  onChange={(e) =>
                    setDetail({ ...detail, fieldAdjusterName: e.target.value })
                  }
                />
              </ClaimField>
              <ClaimField label="Phone">
                <Input
                  disabled={!editable}
                  value={detail.fieldAdjusterPhone}
                  onChange={(e) =>
                    setDetail({ ...detail, fieldAdjusterPhone: e.target.value })
                  }
                />
              </ClaimField>
              <ClaimField label="Email">
                <Input
                  disabled={!editable}
                  value={detail.fieldAdjusterEmail}
                  onChange={(e) =>
                    setDetail({ ...detail, fieldAdjusterEmail: e.target.value })
                  }
                />
              </ClaimField>
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
                    <ClaimField label="Name">
                      <Input
                        disabled={!editable}
                        value={ex.name}
                        onChange={(e) => {
                          const next = [...experts];
                          next[i] = { ...ex, name: e.target.value };
                          setExperts(next);
                        }}
                      />
                    </ClaimField>
                    <ClaimField label="Firm">
                      <Input
                        disabled={!editable}
                        value={ex.firm ?? ""}
                        onChange={(e) => {
                          const next = [...experts];
                          next[i] = { ...ex, firm: e.target.value };
                          setExperts(next);
                        }}
                      />
                    </ClaimField>
                    <ClaimField label="Specialty">
                      <Input
                        disabled={!editable}
                        value={ex.specialty ?? ""}
                        onChange={(e) => {
                          const next = [...experts];
                          next[i] = { ...ex, specialty: e.target.value };
                          setExperts(next);
                        }}
                      />
                    </ClaimField>
                    <ClaimField label="Phone">
                      <Input
                        disabled={!editable}
                        value={ex.phone ?? ""}
                        onChange={(e) => {
                          const next = [...experts];
                          next[i] = { ...ex, phone: e.target.value };
                          setExperts(next);
                        }}
                      />
                    </ClaimField>
                    <ClaimField label="Email" className="sm:col-span-2">
                      <Input
                        disabled={!editable}
                        value={ex.email ?? ""}
                        onChange={(e) => {
                          const next = [...experts];
                          next[i] = { ...ex, email: e.target.value };
                          setExperts(next);
                        }}
                      />
                    </ClaimField>
                    {editable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="sm:col-span-2 justify-self-start"
                        onClick={() => setExperts(experts.filter((_, j) => j !== i))}
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
          <Button className="mt-4" size="sm" variant="outline" onClick={saveCarrier}>
            Save Carrier Contacts
          </Button>
        ) : null}
      </section>

      <section className="border border-brand-white/10 p-4 sm:p-5">
        <p className="eyebrow mb-4">Vendors & Third Parties</p>
        {claim.contacts.length === 0 ? (
          <p className="mb-4 text-sm text-brand-slate">No vendor contacts on file</p>
        ) : (
          <div className="mb-6 space-y-3">
            {claim.contacts.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-3 border border-brand-white/10 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-brand-white">
                    {c.name}
                    {c.company ? (
                      <span className="text-brand-slate"> · {c.company}</span>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-brand-slate">
                    {CONTACT_KIND_LABELS[c.kind]}
                    {c.phone ? ` · ${c.phone}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                  {c.notes ? (
                    <p className="mt-1 text-sm text-brand-white/80">{c.notes}</p>
                  ) : null}
                </div>
                {editable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeVendor(c.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {editable ? (
          <div className="space-y-3 border-t border-brand-white/10 pt-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              Add Contact
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ClaimField label="Kind">
                <Select
                  value={vendorKind}
                  onValueChange={(v) => setVendorKind(v as ContactKind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_KIND_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClaimField>
              <ClaimField label="Name">
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Company">
                <Input
                  value={vendorCompany}
                  onChange={(e) => setVendorCompany(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Phone">
                <Input
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Email">
                <Input
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Notes" className="sm:col-span-2">
                <Textarea
                  value={vendorNotes}
                  onChange={(e) => setVendorNotes(e.target.value)}
                />
              </ClaimField>
            </div>
            <Button size="sm" variant="outline" onClick={addVendor}>
              Add Contact
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
