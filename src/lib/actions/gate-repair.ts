"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  importGateIntakeByNumber,
  repairMissingGateHandoffs,
  type GateImportResult,
} from "@/lib/claims/import-from-gate";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function repairGateHandoffsAction(): Promise<
  ActionResult<{ results: GateImportResult[] }>
> {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMIN") {
      return { ok: false, error: "Only an ADMIN can repair gate handoffs." };
    }

    const results = await repairMissingGateHandoffs();
    revalidatePath("/dashboard");
    for (const row of results) {
      revalidatePath(`/claims/${row.claimId}`);
    }
    return { ok: true, data: { results } };
  } catch (e) {
    console.error("repairGateHandoffsAction:", e);
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Unable to repair BLACKGATE handoffs.",
    };
  }
}

export async function importGateIntakeAction(
  intakeNumber: string
): Promise<ActionResult<GateImportResult>> {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMIN") {
      return { ok: false, error: "Only an ADMIN can import a gate intake." };
    }

    const trimmed = intakeNumber.trim();
    if (!trimmed) {
      return { ok: false, error: "Enter a BLACKGATE intake number (e.g. BG-26-0002)." };
    }

    const result = await importGateIntakeByNumber(trimmed);
    revalidatePath("/dashboard");
    revalidatePath(`/claims/${result.claimId}`);
    return { ok: true, data: result };
  } catch (e) {
    console.error("importGateIntakeAction:", e);
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Unable to import BLACKGATE intake.",
    };
  }
}
