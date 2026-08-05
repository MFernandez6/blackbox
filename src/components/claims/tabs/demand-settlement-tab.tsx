"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { PaymentType } from "@prisma/client";
import { PAYMENT_TYPE_LABELS } from "@/lib/claims/labels";
import { canManagePayments } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/utils";
import { createPaymentAction } from "@/lib/actions/claims";
import { updateDemandSettlementAction } from "@/lib/actions/demand-settlement";
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

function money(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function DemandSettlementTab({
  claim,
  role,
  editable,
}: ClaimWorkspaceProps) {
  const router = useRouter();
  const paymentsOk = canManagePayments(role);
  const canSaveFigures = editable || paymentsOk;

  const [error, setError] = useState("");
  const [demandAmount, setDemandAmount] = useState(claim.demandAmount ?? "");
  const [demandSentDate, setDemandSentDate] = useState(
    claim.demandSentDate?.slice(0, 10) ?? ""
  );
  const [rcvAmount, setRcvAmount] = useState(claim.rcvAmount ?? "");
  const [acvAmount, setAcvAmount] = useState(claim.acvAmount ?? "");
  const [settlementAmount, setSettlementAmount] = useState(
    claim.settlementAmount ?? ""
  );
  const [settlementDate, setSettlementDate] = useState(
    claim.settlementDate?.slice(0, 10) ?? ""
  );
  const [settlementNotes, setSettlementNotes] = useState(
    claim.settlementNotes ?? ""
  );

  const feePct = money(claim.contingencyFeePercent) ?? 20;
  const feeBase =
    money(settlementAmount) ??
    money(demandAmount) ??
    money(claim.estimatedValue);
  const projectedFee =
    feeBase !== null ? (feeBase * feePct) / 100 : null;

  const paymentsTotal = useMemo(
    () =>
      claim.payments.reduce((sum, p) => sum + (money(p.amount) ?? 0), 0),
    [claim.payments]
  );

  const settlement = money(settlementAmount);
  const outstanding =
    settlement !== null ? Math.max(0, settlement - paymentsTotal) : null;

  async function saveFigures() {
    setError("");
    const result = await updateDemandSettlementAction(claim.id, {
      demandAmount: demandAmount || null,
      demandSentDate: demandSentDate || null,
      rcvAmount: rcvAmount || null,
      acvAmount: acvAmount || null,
      settlementAmount: settlementAmount || null,
      settlementDate: settlementDate || null,
      settlementNotes: settlementNotes || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Demand / settlement updated");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="border border-brand-white/10 p-5">
        <p className="eyebrow mb-4">Demand Package</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ClaimField label="Demand Amount">
            <Input
              disabled={!canSaveFigures}
              value={demandAmount}
              onChange={(e) => setDemandAmount(e.target.value)}
              placeholder="0.00"
            />
          </ClaimField>
          <ClaimField label="Demand Sent">
            <Input
              type="date"
              disabled={!canSaveFigures}
              value={demandSentDate}
              onChange={(e) => setDemandSentDate(e.target.value)}
            />
          </ClaimField>
          <ClaimField label="RCV">
            <Input
              disabled={!canSaveFigures}
              value={rcvAmount}
              onChange={(e) => setRcvAmount(e.target.value)}
              placeholder="Replacement cost"
            />
          </ClaimField>
          <ClaimField label="ACV">
            <Input
              disabled={!canSaveFigures}
              value={acvAmount}
              onChange={(e) => setAcvAmount(e.target.value)}
              placeholder="Actual cash value"
            />
          </ClaimField>
        </div>
      </section>

      <section className="border border-brand-white/10 p-5">
        <p className="eyebrow mb-4">Settlement Tracking</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ClaimField label="Settlement Amount">
            <Input
              disabled={!canSaveFigures}
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(e.target.value)}
              placeholder="Agreed amount"
            />
          </ClaimField>
          <ClaimField label="Settlement Date">
            <Input
              type="date"
              disabled={!canSaveFigures}
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </ClaimField>
          <ClaimField label="Notes" className="sm:col-span-2 lg:col-span-3">
            <Textarea
              disabled={!canSaveFigures}
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              placeholder="Settlement posture, carrier counter, conditions…"
            />
          </ClaimField>
        </div>
        {canSaveFigures ? (
          <Button className="mt-4" size="sm" variant="outline" onClick={saveFigures}>
            Save Demand / Settlement
          </Button>
        ) : null}
      </section>

      <section className="border border-brand-white/10 p-5">
        <p className="eyebrow mb-4">Fee Calc Summary</p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat
            label="Contingency"
            value={`${feePct}%${claim.isCatClaim ? " (CAT)" : ""}`}
          />
          <SummaryStat
            label="Fee Base"
            value={feeBase !== null ? formatCurrency(feeBase) : "—"}
            hint="Settlement → demand → estimate"
          />
          <SummaryStat
            label="Projected Fee"
            value={
              projectedFee !== null ? formatCurrency(projectedFee) : "—"
            }
          />
          <SummaryStat
            label="Payments Logged"
            value={formatCurrency(paymentsTotal)}
          />
          <SummaryStat
            label="Settlement Outstanding"
            value={
              outstanding !== null ? formatCurrency(outstanding) : "—"
            }
            hint="Settlement − payments"
          />
          <SummaryStat
            label="Est. Claim Value"
            value={
              claim.estimatedValue
                ? formatCurrency(claim.estimatedValue)
                : "—"
            }
          />
        </dl>
      </section>

      {paymentsOk ? (
        <PaymentPanel claimId={claim.id} payments={claim.payments} />
      ) : (
        <section className="border border-brand-white/10 p-5">
          <p className="eyebrow mb-4">Payment Log</p>
          <p className="text-sm text-brand-slate">
            Payment entries are restricted to administrators. Fee figures above
            remain visible for file posture.
          </p>
          {claim.payments.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {claim.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between border-b border-brand-white/10 py-2"
                >
                  <span className="font-mono text-xs text-brand-slate">
                    {PAYMENT_TYPE_LABELS[p.type]} ·{" "}
                    {format(new Date(p.date), "yyyy-MM-dd")}
                  </span>
                  <span className="font-mono text-xs">
                    {formatCurrency(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-brand-white/10 p-3">
      <dt className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm text-brand-gold">{value}</dd>
      {hint ? (
        <p className="mt-1 text-[10px] text-brand-slate">{hint}</p>
      ) : null}
    </div>
  );
}

function PaymentPanel({
  claimId,
  payments,
}: {
  claimId: string;
  payments: ClaimWorkspaceProps["claim"]["payments"];
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
