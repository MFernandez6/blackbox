"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanEditClaim } from "@/lib/claims/access";
import { logClaimAudit } from "@/lib/claims/audit";
import { claudeConfigured } from "@/lib/ai/claude";
import { parseLimitsJson } from "@/lib/policy-extraction";
import type { SettlementEstimate } from "@/lib/claims/settlement-estimate";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export async function runSettlementEstimateAction(
  claimId: string
): Promise<ActionResult<SettlementEstimate>> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }
    if (!claudeConfigured()) {
      return {
        ok: false,
        error:
          "ANTHROPIC_API_KEY is not configured. Set it in .env / Vercel to enable the settlement estimate.",
      };
    }

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        policies: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        payments: { select: { type: true, amount: true } },
      },
    });
    if (!claim) return { ok: false, error: "Claim not found." };

    const carrierPaymentsLogged = claim.payments
      .filter((p) => p.type !== "FEE")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const coverage = claim.policies.length
      ? claim.policies.map((p) => ({
          line: p.line,
          limits: parseLimitsJson(p.limits).map((l) => ({
            label: l.label,
            amount: l.amount ?? null,
          })),
          deductibleNotes: p.deductibleNotes,
        }))
      : [
          {
            line: "HOMEOWNERS",
            limits: [
              { label: "Coverage A (Dwelling)", amount: toNumber(claim.coverageALimit) },
              { label: "Coverage B (Other Structures)", amount: toNumber(claim.coverageBLimit) },
              { label: "Coverage C (Personal Property)", amount: toNumber(claim.coverageCLimit) },
              { label: "Coverage D (Loss of Use)", amount: toNumber(claim.coverageDLimit) },
            ],
            deductibleNotes: null,
          },
        ].filter((p) => p.limits.some((l) => l.amount !== null));

    const actor = await prisma.adjuster.findUnique({
      where: { id: gate.session.user.id },
      select: { name: true },
    });

    const { estimateSettlement } = await import("@/lib/ai/settlement-estimate");
    const estimate = await estimateSettlement(
      {
        lossType: claim.lossType,
        dateOfLoss: claim.dateOfLoss.toISOString(),
        county: claim.county,
        zipCode: claim.zipCode,
        isCatClaim: claim.isCatClaim,
        status: claim.status,
        carrierName: claim.carrierName,
        lossDescription: claim.lossDescription,
        figures: {
          estimatedValue: toNumber(claim.estimatedValue),
          rcvAmount: toNumber(claim.rcvAmount),
          acvAmount: toNumber(claim.acvAmount),
          demandAmount: toNumber(claim.demandAmount),
          carrierPaymentsLogged,
        },
        coverage,
      },
      actor?.name ?? "Staff"
    );

    const now = new Date();
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        settlementEstimate: estimate as unknown as Prisma.InputJsonValue,
        settlementEstimateAt: now,
      },
    });

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "SETTLEMENT_ESTIMATE",
      entityType: "Claim",
      entityId: claimId,
      summary: `Settlement estimate run: likely $${estimate.range.likely.toLocaleString("en-US")} (${estimate.confidence.toLowerCase()} confidence)`,
      meta: { model: estimate.model, searches: estimate.searches },
    });

    revalidatePath(`/claims/${claimId}`);
    return { ok: true, data: estimate };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Settlement estimate failed.",
    };
  }
}
