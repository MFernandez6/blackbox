"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { EmailDirection } from "@prisma/client";
import { EMAIL_DIRECTION_LABELS } from "@/lib/claims/labels";
import {
  createClaimEmailAction,
  deleteClaimEmailAction,
} from "@/lib/actions/claim-workspace";
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

export function EmailsTab({ claim, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<EmailDirection>("INBOUND");
  const [subject, setSubject] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [ccAddress, setCcAddress] = useState("");
  const [body, setBody] = useState("");
  const [emailDate, setEmailDate] = useState("");

  async function addEmail() {
    setError("");
    const result = await createClaimEmailAction({
      claimId: claim.id,
      direction,
      subject,
      fromAddress,
      toAddress,
      ccAddress: ccAddress || null,
      body,
      emailDate,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Email logged");
    setSubject("");
    setFromAddress("");
    setToAddress("");
    setCcAddress("");
    setBody("");
    setEmailDate("");
    router.refresh();
  }

  async function removeEmail(id: string) {
    if (!confirm("Delete this email record?")) return;
    setError("");
    const result = await deleteClaimEmailAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Email deleted");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="border border-brand-white/10 p-5">
        <p className="eyebrow mb-4">Email Correspondence</p>
        {claim.emails.length === 0 ? (
          <p className="mb-4 text-sm text-brand-slate">No emails logged</p>
        ) : (
          <div className="mb-6 space-y-4">
            {claim.emails.map((e) => (
              <div
                key={e.id}
                className="border border-brand-white/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-brand-white">
                      {e.subject}
                    </p>
                    <p className="mt-1 font-mono text-xs text-brand-slate">
                      {EMAIL_DIRECTION_LABELS[e.direction]} ·{" "}
                      {format(new Date(e.emailDate), "yyyy-MM-dd HH:mm")} ·{" "}
                      {e.createdByName}
                    </p>
                    <p className="mt-1 text-xs text-brand-slate">
                      From: {e.fromAddress} · To: {e.toAddress}
                      {e.ccAddress ? ` · CC: ${e.ccAddress}` : ""}
                    </p>
                  </div>
                  {editable ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEmail(e.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-brand-white/90">
                  {e.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {editable ? (
          <div className="space-y-3 border-t border-brand-white/10 pt-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              Log Email
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ClaimField label="Direction">
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v as EmailDirection)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMAIL_DIRECTION_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClaimField>
              <ClaimField label="Email Date">
                <Input
                  type="datetime-local"
                  value={emailDate}
                  onChange={(e) => setEmailDate(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Subject" className="sm:col-span-2">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="From">
                <Input
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="To">
                <Input
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="CC" className="sm:col-span-2">
                <Input
                  value={ccAddress}
                  onChange={(e) => setCcAddress(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Body" className="sm:col-span-2">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                />
              </ClaimField>
            </div>
            <Button size="sm" variant="outline" onClick={addEmail}>
              Log Email
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
