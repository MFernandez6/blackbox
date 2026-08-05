"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { ClaimStatus, AdjusterRole } from "@prisma/client";
import { STATUS_LABELS, LOSS_TYPE_LABELS } from "@/lib/claims/labels";
import { canEdit } from "@/lib/auth-client";
import {
  changeClaimStatusAction,
  archiveClaimAction,
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
};

export function ClaimDetailClient({
  claim,
  adjusters,
  role,
  initialTab,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editable = canEdit(role);

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

  return (
    <div className="space-y-6">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      {/* Hero */}
      <div className="border-b border-brand-white/10 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Secure Record</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  BL Claim #
                </p>
                <h1 className="font-mono text-lg tracking-wide text-brand-gold">
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
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <StatusBadge status={claim.status} />
                {claim.isCatClaim ? (
                  <Badge className="border-brand-white/10 text-brand-slate">
                    CAT
                  </Badge>
                ) : null}
                {claim.isArchived ? (
                  <Badge className="border-denied text-denied">Archived</Badge>
                ) : null}
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroMeta label="Insured" value={insuredName} />
              <HeroMeta
                label="Date of Loss"
                value={format(new Date(claim.dateOfLoss), "MMM d, yyyy")}
                mono
              />
              <HeroMeta label="Insurer" value={claim.carrierName || "—"} />
              <HeroMeta
                label="Policy #"
                value={claim.policyNumber || "—"}
                mono
              />
            </dl>

            <p className="mt-3 text-sm text-brand-slate">
              {LOSS_TYPE_LABELS[claim.lossType]} · {claim.propertyAddress} ·{" "}
              Assigned:{" "}
              {adjusters.find((a) => a.id === claim.assignedAdjusterId)?.name ??
                "Unassigned"}{" "}
              · Fee {claim.contingencyFeePercent}%
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <GoogleMapsButton
              address={claim.propertyAddress}
              zipCode={claim.zipCode}
            />
            <Button asChild size="sm" variant="outline">
              <Link href={`/claims/${claim.id}/print`} target="_blank">
                Print sheet
              </Link>
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
      </div>

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
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-1 font-mono text-sm tracking-wide text-brand-white"
            : "mt-1 font-serif text-base text-brand-white"
        }
      >
        {value}
      </dd>
    </div>
  );
}
