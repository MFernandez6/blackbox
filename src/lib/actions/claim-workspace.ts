"use server";

import { revalidatePath } from "next/cache";
import { requireSession, canEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  claimDatesUpdateSchema,
  claimContactCreateSchema,
  claimContactUpdateSchema,
  claimTaskCreateSchema,
  claimTaskUpdateSchema,
  claimNoteCreateSchema,
  claimEmailCreateSchema,
} from "@/lib/schemas/claim-workspace";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateClaim(claimId: string) {
  revalidatePath(`/claims/${claimId}`);
  revalidatePath(`/claims/${claimId}/documents`);
  revalidatePath("/dashboard");
}

async function assertCanEditClaim(claimId: string) {
  const session = await requireSession();
  if (!canEdit(session.user.role)) {
    return { session, error: "Insufficient privileges." as const };
  }
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, assignedAdjusterId: true, isArchived: true },
  });
  if (!claim) return { session, error: "Claim not found." as const };
  if (claim.isArchived) {
    return { session, error: "Archived files are sealed." as const };
  }
  if (
    session.user.role === "ADJUSTER" &&
    claim.assignedAdjusterId !== session.user.id
  ) {
    return { session, error: "Not assigned to this file." as const };
  }
  return { session, claim, error: null };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

export async function updateClaimDatesAction(
  claimId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const gate = await assertCanEditClaim(claimId);
    if (gate.error) return { ok: false, error: gate.error };

    const parsed = claimDatesUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const d = parsed.data;
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        initialContactDate: parseDate(d.initialContactDate),
        scheduledAppointmentDate: parseDate(d.scheduledAppointmentDate),
        lossInspectedDate: parseDate(d.lossInspectedDate),
        estimateCreatedDate: parseDate(d.estimateCreatedDate),
        reportCreatedDate: parseDate(d.reportCreatedDate),
        estimateSentDate: parseDate(d.estimateSentDate),
      },
    });

    revalidateClaim(claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to update claim dates." };
  }
}

export async function createClaimContactAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = claimContactCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }
    const gate = await assertCanEditClaim(parsed.data.claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const row = await prisma.claimContact.create({
      data: {
        claimId: parsed.data.claimId,
        kind: parsed.data.kind,
        name: parsed.data.name,
        company: parsed.data.company || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        createdById: gate.session.user.id,
      },
    });

    revalidateClaim(parsed.data.claimId);
    return { ok: true, data: { id: row.id } };
  } catch {
    return { ok: false, error: "Unable to add contact." };
  }
}

export async function updateClaimContactAction(
  raw: unknown
): Promise<ActionResult> {
  try {
    const parsed = claimContactUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const existing = await prisma.claimContact.findUnique({
      where: { id: parsed.data.id },
      select: { claimId: true },
    });
    if (!existing) return { ok: false, error: "Contact not found." };

    const gate = await assertCanEditClaim(existing.claimId);
    if (gate.error) return { ok: false, error: gate.error };

    await prisma.claimContact.update({
      where: { id: parsed.data.id },
      data: {
        kind: parsed.data.kind,
        name: parsed.data.name,
        company: parsed.data.company || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
      },
    });

    revalidateClaim(existing.claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to update contact." };
  }
}

export async function deleteClaimContactAction(
  id: string
): Promise<ActionResult> {
  try {
    const existing = await prisma.claimContact.findUnique({
      where: { id },
      select: { claimId: true },
    });
    if (!existing) return { ok: false, error: "Contact not found." };

    const gate = await assertCanEditClaim(existing.claimId);
    if (gate.error) return { ok: false, error: gate.error };

    await prisma.claimContact.delete({ where: { id } });
    revalidateClaim(existing.claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to remove contact." };
  }
}

export async function createClaimTaskAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = claimTaskCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }
    const gate = await assertCanEditClaim(parsed.data.claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const row = await prisma.claimTask.create({
      data: {
        claimId: parsed.data.claimId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        dueDate: parseDate(parsed.data.dueDate),
        assignedToId: parsed.data.assignedToId || null,
        status: parsed.data.status ?? "OPEN",
        createdById: gate.session.user.id,
      },
    });

    revalidateClaim(parsed.data.claimId);
    return { ok: true, data: { id: row.id } };
  } catch {
    return { ok: false, error: "Unable to create task." };
  }
}

export async function updateClaimTaskAction(
  raw: unknown
): Promise<ActionResult> {
  try {
    const parsed = claimTaskUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }

    const existing = await prisma.claimTask.findUnique({
      where: { id: parsed.data.id },
      select: { claimId: true },
    });
    if (!existing) return { ok: false, error: "Task not found." };

    const gate = await assertCanEditClaim(existing.claimId);
    if (gate.error) return { ok: false, error: gate.error };

    const { id, ...rest } = parsed.data;
    await prisma.claimTask.update({
      where: { id },
      data: {
        ...(rest.title !== undefined ? { title: rest.title } : {}),
        ...(rest.description !== undefined
          ? { description: rest.description || null }
          : {}),
        ...(rest.dueDate !== undefined
          ? { dueDate: parseDate(rest.dueDate) }
          : {}),
        ...(rest.assignedToId !== undefined
          ? { assignedToId: rest.assignedToId || null }
          : {}),
        ...(rest.status !== undefined ? { status: rest.status } : {}),
      },
    });

    revalidateClaim(existing.claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to update task." };
  }
}

export async function deleteClaimTaskAction(id: string): Promise<ActionResult> {
  try {
    const existing = await prisma.claimTask.findUnique({
      where: { id },
      select: { claimId: true },
    });
    if (!existing) return { ok: false, error: "Task not found." };

    const gate = await assertCanEditClaim(existing.claimId);
    if (gate.error) return { ok: false, error: gate.error };

    await prisma.claimTask.delete({ where: { id } });
    revalidateClaim(existing.claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to delete task." };
  }
}

export async function createClaimNoteAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = claimNoteCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }
    const gate = await assertCanEditClaim(parsed.data.claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const row = await prisma.claimNote.create({
      data: {
        claimId: parsed.data.claimId,
        body: parsed.data.body,
        createdById: gate.session.user.id,
      },
    });

    revalidateClaim(parsed.data.claimId);
    return { ok: true, data: { id: row.id } };
  } catch {
    return { ok: false, error: "Unable to add note." };
  }
}

export async function deleteClaimNoteAction(id: string): Promise<ActionResult> {
  try {
    const existing = await prisma.claimNote.findUnique({
      where: { id },
      select: { claimId: true, createdById: true },
    });
    if (!existing) return { ok: false, error: "Note not found." };

    const gate = await assertCanEditClaim(existing.claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }
    if (
      gate.session.user.role !== "ADMIN" &&
      existing.createdById !== gate.session.user.id
    ) {
      return { ok: false, error: "Only the author or an admin can delete." };
    }

    await prisma.claimNote.delete({ where: { id } });
    revalidateClaim(existing.claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to delete note." };
  }
}

export async function createClaimEmailAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = claimEmailCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.errors[0]?.message ?? "Validation failed.",
      };
    }
    const gate = await assertCanEditClaim(parsed.data.claimId);
    if (gate.error || !gate.session) {
      return { ok: false, error: gate.error ?? "Unauthorized." };
    }

    const row = await prisma.claimEmail.create({
      data: {
        claimId: parsed.data.claimId,
        direction: parsed.data.direction,
        subject: parsed.data.subject,
        fromAddress: parsed.data.fromAddress,
        toAddress: parsed.data.toAddress,
        ccAddress: parsed.data.ccAddress || null,
        body: parsed.data.body,
        emailDate: new Date(parsed.data.emailDate),
        createdById: gate.session.user.id,
      },
    });

    revalidateClaim(parsed.data.claimId);
    return { ok: true, data: { id: row.id } };
  } catch {
    return { ok: false, error: "Unable to log email." };
  }
}

export async function deleteClaimEmailAction(
  id: string
): Promise<ActionResult> {
  try {
    const existing = await prisma.claimEmail.findUnique({
      where: { id },
      select: { claimId: true },
    });
    if (!existing) return { ok: false, error: "Email not found." };

    const gate = await assertCanEditClaim(existing.claimId);
    if (gate.error) return { ok: false, error: gate.error };

    await prisma.claimEmail.delete({ where: { id } });
    revalidateClaim(existing.claimId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to delete email." };
  }
}
