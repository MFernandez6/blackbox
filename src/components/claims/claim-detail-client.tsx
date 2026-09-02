"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { ClaimStatus, AdjusterRole } from "@prisma/client";
import { STATUS_LABELS, LOSS_TYPE_LABELS } from "@/lib/claims/labels";
import { canEdit } from "@/lib/auth-client";
import { formatCurrency, formatFeePercent, projectedContingencyFee } from "@/lib/utils";
import {
  changeClaimStatusAction,
  archiveClaimAction,
  deleteClaimAction,
} from "@/lib/actions/claims";
import type {
  ClaimDetailData,
  AdjusterOption,
} from "@/components/claims/claim-detail-types";
import {
  OverviewTab,
  ContactsTab,
  TasksTab,
  ActivityTab,
  DemandSettlementTab,
  EmailsTab,
  DatesTab,
} from "@/components/claims/tabs";
import { DocumentsVaultClient } from "@/components/claims/documents-vault-client";
import { NextDocumentCard } from "@/components/claims/next-document-card";
import { StatusBadge } from "@/components/claims/status-badge";
import { GoogleMapsButton } from "@/components/claims/google-maps-button";
import { ClaimField } from "@/components/claims/claim-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type { ClaimDetailData } from "@/components/claims/claim-detail-types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts / Vendors" },
  { id: "tasks", label: "Tasks" },
  { id: "documents", label: "Documents Vault" },
  { id: "activity", label: "Activity" },
  { id: "demand", label: "Demand / Settlement" },
  { id: "emails", label: "Email" },
  { id: "dates", label: "Dates" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

type Props = {
  claim: ClaimDetailData;
  adjusters: AdjusterOption[];
  role: AdjusterRole;
  initialTab?: string;
  letterUrl: string;
};

export function ClaimDetailClient({
  claim,
  adjusters,
  role,
  initialTab,
  letterUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editable = canEdit(role);
  const canDelete = role === "ADMIN";

  const tabFromUrl = searchParams.get("tab");
  const normalizedTab =
    tabFromUrl === "payments" ? "demand" : tabFromUrl;
  const activeTab: TabId = isTabId(normalizedTab)
    ? normalizedTab
    : isTabId(initialTab ?? null)
      ? (initialTab as TabId)
      : "overview";

  const [error, setError] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ClaimStatus>(claim.status);
  const [statusNote, setStatusNote] = useState("");

  const primary =
    claim.claimants.find((c) => c.isPrimaryContact) ?? claim.claimants[0];
  const insuredName = primary
    ? `${primary.firstName} ${primary.lastName}`.trim()
    : "—";

  const fee = projectedContingencyFee({
    percent: claim.contingencyFeePercent,
    settlementAmount: claim.settlementAmount,
    demandAmount: claim.demandAmount,
    estimatedValue: claim.estimatedValue,
  });
  const feeHint =
    fee.basis === "settlement"
      ? "on settlement"
      : fee.basis === "demand"
        ? "on demand"
        : fee.basis === "estimate"
          ? "on estimate"
          : "Add settlement, demand, or estimate to see dollars";

  const workspace = { claim, adjusters, role, editable };

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
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

  async function removeFile() {
    if (
      !confirm(
        `Permanently delete ${claim.claimNumber}? Related records will be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    const result = await deleteClaimAction(claim.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("File deleted");
    router.push("/dashboard");
  }

  return (
    <div className="min-w-0 space-y-6">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      {/* Hero */}
      <div className="border-b border-brand-white/10 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 font-serif">
            <p className="font-serif text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Secure Record
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="font-serif text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  BL Claim #
                </p>
                <h1 className="font-serif text-lg tracking-wide text-brand-gold">
                  {claim.claimNumber}
                </h1>
              </div>
              <div>
                <p className="font-serif text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  NI Claim #
                </p>
                <p className="font-serif text-lg tracking-wide text-brand-white">
                  {claim.insurerClaimNumber || "—"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <StatusBadge status={claim.status} className="font-serif" />
                {claim.isCatClaim ? (
                  <Badge className="border-brand-white/10 font-serif text-brand-slate">
                    CAT
                  </Badge>
                ) : null}
                {claim.isArchived ? (
                  <Badge className="border-denied/50 bg-denied-muted font-serif text-denied-soft">
                    Archived
                  </Badge>
                ) : null}
                {claim.sourceProduct === "BLACKGATE" && claim.sourceIntakeNumber ? (
                  <Badge className="border-brand-gold/40 font-serif text-brand-gold">
                    BLACKGATE · {claim.sourceIntakeNumber}
                  </Badge>
                ) : null}
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroMeta label="Insured" value={insuredName} />
              <HeroMeta
                label="Date of Loss"
                value={format(new Date(claim.dateOfLoss), "MMM d, yyyy")}
              />
              <HeroMeta label="Insurer" value={claim.carrierName || "—"} />
              <HeroMeta label="Policy #" value={claim.policyNumber || "—"} />
            </dl>

            <dl className="mt-4 space-y-2">
              <HeroMeta
                label="Loss Type"
                value={LOSS_TYPE_LABELS[claim.lossType]}
              />
              <HeroMeta
                label="Risk Address"
                value={claim.propertyAddress}
              />
              <HeroMeta
                label="Adjuster Assigned"
                value={
                  adjusters.find((a) => a.id === claim.assignedAdjusterId)
                    ?.name ?? "Unassigned"
                }
              />
              <HeroMeta
                label="Fee"
                value={
                  fee.dollars !== null
                    ? `${formatFeePercent(claim.contingencyFeePercent)} · ${formatCurrency(fee.dollars)}`
                    : formatFeePercent(claim.contingencyFeePercent)
                }
                hint={feeHint}
              />
            </dl>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <GoogleMapsButton
              address={claim.propertyAddress}
              zipCode={claim.zipCode}
              className="w-full sm:w-auto"
            />
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
              <Link href={`/claims/${claim.id}/print`} target="_blank">
                Print sheet
              </Link>
            </Button>
            {editable && !claim.isArchived ? (
              <>
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setStatusOpen(true)}
                >
                  Change Status
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={archive}
                >
                  Archive
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button
                size="sm"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={removeFile}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {claim.sourceProduct === "BLACKGATE" && claim.sourceIntakeId ? (
        <div className="border border-brand-white/10 px-4 py-3">
          <p className="eyebrow">BLACKGATE</p>
          <p className="mt-2 text-sm text-brand-white/80">
            Opened from intake {claim.sourceIntakeNumber ?? claim.sourceIntakeId}.
            Documents collected at the gate are filed in this vault.
          </p>
        </div>
      ) : null}

      <NextDocumentCard
        claimId={claim.id}
        claimNumber={claim.claimNumber}
        letterUrl={letterUrl}
      />

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab {...workspace} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab {...workspace} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab {...workspace} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsVaultClient
            claimId={claim.id}
            claimNumber={claim.claimNumber}
            documents={claim.documents}
            role={role}
            embedded
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab {...workspace} />
        </TabsContent>
        <TabsContent value="demand">
          <DemandSettlementTab {...workspace} />
        </TabsContent>
        <TabsContent value="emails">
          <EmailsTab {...workspace} />
        </TabsContent>
        <TabsContent value="dates">
          <DatesTab {...workspace} />
        </TabsContent>
      </Tabs>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow">Claim Status</p>
            <DialogTitle>Change Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ClaimField label="New Status">
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
            </ClaimField>
            <ClaimField label="Note (required)">
              <Textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Reason for status change"
              />
            </ClaimField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitStatus}>Log Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeroMeta({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="font-serif text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-base text-brand-white">{value}</dd>
      {hint ? (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
