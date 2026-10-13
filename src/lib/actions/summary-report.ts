"use server";

import { revalidatePath } from "next/cache";
import { assertCanEditClaim } from "@/lib/claims/access";
import {
  saveSummaryReport,
  summaryReportInputSchema,
} from "@/lib/reports/summary-report-server";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function saveSummaryReportAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error) return { ok: false, error: gate.error };

    const parsed = summaryReportInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    await saveSummaryReport({
      claimId,
      actorId: gate.session.user.id,
      via: "BLACKBOX",
      input: parsed.data,
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath(`/claims/${claimId}/summary-report`);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save the summary report." };
  }
}
