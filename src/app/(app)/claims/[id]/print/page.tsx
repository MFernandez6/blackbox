import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  LOSS_TYPE_LABELS,
  STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/claims/labels";
import { formatCurrency, projectedContingencyFee } from "@/lib/utils";
import { StatusBadge } from "@/components/claims/status-badge";
import { ClaimPrintActions } from "@/components/claims/claim-print-actions";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null | undefined): string {
  return value ? format(value, "MMM d, yyyy") : "—";
}

export default async function ClaimPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const claim = await prisma.claim.findUnique({
    where: { id: params.id },
    include: {
      claimants: { orderBy: { isPrimaryContact: "desc" } },
      assignedAdjuster: { select: { name: true } },
      payments: { orderBy: { date: "desc" } },
    },
  });

  if (!claim) notFound();

  if (
    session.user.role === "ADJUSTER" &&
    claim.assignedAdjusterId !== session.user.id
  ) {
    redirect("/dashboard");
  }

  const paymentTotal = claim.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const fee = projectedContingencyFee({
    percent: claim.contingencyFeePercent.toString(),
    settlementAmount: claim.settlementAmount?.toString() ?? null,
    demandAmount: claim.demandAmount?.toString() ?? null,
    estimatedValue: claim.estimatedValue?.toString() ?? null,
  });
  const feePct = fee.percent ?? Number(claim.contingencyFeePercent);
  const feeBase = Number(
    claim.settlementAmount ?? claim.demandAmount ?? claim.estimatedValue ?? 0
  );
  const projectedFee = fee.dollars ?? feeBase * (feePct / 100);
  const outstanding = Number(claim.settlementAmount ?? 0) - paymentTotal;

  return (
    <ClaimPrintActions claimNumber={claim.claimNumber}>
      <header className="border-b border-brand-white/10 pb-4">
        <p className="eyebrow">Demand Packet / Claim Summary</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              BL Claim #
            </p>
            <p className="font-mono text-lg tracking-wide text-brand-gold">
              {claim.claimNumber}
            </p>
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
        </div>
        <p className="mt-3 text-sm text-brand-slate">
          Generated {format(new Date(), "MMM d, yyyy HH:mm")} · Assigned:{" "}
          {claim.assignedAdjuster?.name ?? "Unassigned"}
        </p>
      </header>

      <section>
        <p className="eyebrow mb-3">File Overview</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <PrintField label="Loss Type" value={LOSS_TYPE_LABELS[claim.lossType]} />
          <PrintField
            label="Date of Loss"
            value={format(claim.dateOfLoss, "MMM d, yyyy")}
            mono
          />
          <PrintField label="Status" value={STATUS_LABELS[claim.status]} />
          <PrintField label="Property" value={claim.propertyAddress} />
          <PrintField label="County" value={claim.county} />
          <PrintField label="Zip" value={claim.zipCode} mono />
          <PrintField label="Carrier" value={claim.carrierName || "—"} />
          <PrintField label="Policy #" value={claim.policyNumber || "—"} mono />
          <PrintField
            label="Est. Value"
            value={formatCurrency(claim.estimatedValue?.toString())}
            mono
          />
          <PrintField
            label="Contingency Fee"
            value={
              fee.dollars !== null
                ? `${claim.contingencyFeePercent}% · ${formatCurrency(fee.dollars)}`
                : `${claim.contingencyFeePercent}%`
            }
            mono
          />
          {claim.isCatClaim ? (
            <PrintField label="CAT Claim" value="Yes" />
          ) : null}
        </dl>
        {claim.lossDescription ? (
          <div className="mt-4">
            <p className="eyebrow mb-1">Loss Description</p>
            <p className="text-sm text-brand-white/90">{claim.lossDescription}</p>
          </div>
        ) : null}
      </section>

      <section>
        <p className="eyebrow mb-3">Claimants</p>
        {claim.claimants.length === 0 ? (
          <p className="text-sm text-brand-slate">No claimants on file.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-white/10 text-left">
                <th className="py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Name
                </th>
                <th className="py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Contact
                </th>
                <th className="py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Primary
                </th>
              </tr>
            </thead>
            <tbody>
              {claim.claimants.map((c) => (
                <tr key={c.id} className="border-b border-brand-white/10 last:border-0">
                  <td className="py-2 text-brand-white">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="py-2 font-mono text-xs text-brand-slate">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-2 text-brand-slate">
                    {c.isPrimaryContact ? "Yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="eyebrow mb-3">Coverage</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <PrintField
            label="Coverage A"
            value={formatCurrency(claim.coverageALimit?.toString())}
            mono
          />
          <PrintField
            label="Coverage B"
            value={formatCurrency(claim.coverageBLimit?.toString())}
            mono
          />
          <PrintField
            label="Coverage C"
            value={formatCurrency(claim.coverageCLimit?.toString())}
            mono
          />
          <PrintField
            label="Coverage D"
            value={formatCurrency(claim.coverageDLimit?.toString())}
            mono
          />
        </dl>
        {claim.policyExclusions ? (
          <div className="mt-3">
            <p className="eyebrow mb-1">Exclusions</p>
            <p className="whitespace-pre-wrap text-sm text-brand-white/90">
              {claim.policyExclusions}
            </p>
          </div>
        ) : null}
        {claim.policyEndorsements ? (
          <div className="mt-3">
            <p className="eyebrow mb-1">Endorsements</p>
            <p className="whitespace-pre-wrap text-sm text-brand-white/90">
              {claim.policyEndorsements}
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <p className="eyebrow mb-3">Key Dates</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <PrintField label="Initial Contact" value={fmtDate(claim.initialContactDate)} mono />
          <PrintField
            label="Scheduled Appointment"
            value={fmtDate(claim.scheduledAppointmentDate)}
            mono
          />
          <PrintField label="Loss Inspected" value={fmtDate(claim.lossInspectedDate)} mono />
          <PrintField
            label="Estimate Created"
            value={fmtDate(claim.estimateCreatedDate)}
            mono
          />
          <PrintField label="Report Created" value={fmtDate(claim.reportCreatedDate)} mono />
          <PrintField label="Estimate Sent" value={fmtDate(claim.estimateSentDate)} mono />
          <PrintField label="File Opened" value={fmtDate(claim.createdAt)} mono />
        </dl>
      </section>

      <section>
        <p className="eyebrow mb-3">Demand / Settlement</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <PrintField
            label="Demand"
            value={formatCurrency(claim.demandAmount?.toString())}
            mono
          />
          <PrintField label="Demand Sent" value={fmtDate(claim.demandSentDate)} mono />
          <PrintField
            label="RCV"
            value={formatCurrency(claim.rcvAmount?.toString())}
            mono
          />
          <PrintField
            label="ACV"
            value={formatCurrency(claim.acvAmount?.toString())}
            mono
          />
          <PrintField
            label="Settlement"
            value={formatCurrency(claim.settlementAmount?.toString())}
            mono
          />
          <PrintField label="Settlement Date" value={fmtDate(claim.settlementDate)} mono />
          <PrintField
            label={`Contingency Fee (${feePct}%)`}
            value={formatCurrency(String(projectedFee))}
            mono
          />
          <PrintField
            label="Fee Base"
            value={formatCurrency(String(feeBase))}
            mono
          />
          <PrintField
            label="Outstanding vs Settlement"
            value={formatCurrency(String(outstanding))}
            mono
          />
        </dl>
        {claim.settlementNotes ? (
          <div className="mt-3">
            <p className="eyebrow mb-1">Settlement Notes</p>
            <p className="whitespace-pre-wrap text-sm text-brand-white/90">
              {claim.settlementNotes}
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <p className="eyebrow mb-3">Payments Summary</p>
        <p className="mb-3 font-mono text-sm text-brand-white">
          Total recorded: {formatCurrency(paymentTotal)}
        </p>
        {claim.payments.length === 0 ? (
          <p className="text-sm text-brand-slate">No payments recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-white/10 text-left">
                <th className="py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Date
                </th>
                <th className="py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Type
                </th>
                <th className="py-2 text-right font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {claim.payments.map((p) => (
                <tr key={p.id} className="border-b border-brand-white/10 last:border-0">
                  <td className="py-2 font-mono text-xs text-brand-slate">
                    {format(p.date, "yyyy-MM-dd")}
                  </td>
                  <td className="py-2 text-brand-white">
                    {PAYMENT_TYPE_LABELS[p.type]}
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {formatCurrency(p.amount.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </ClaimPrintActions>
  );
}

function PrintField({
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
      <dd className={mono ? "font-mono text-xs text-brand-white" : "text-sm text-brand-white/90"}>
        {value}
      </dd>
    </div>
  );
}
