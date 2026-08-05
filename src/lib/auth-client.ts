import type { AdjusterRole } from "@prisma/client";

/** Client-safe role helpers (no server imports). */
export function canEdit(role: AdjusterRole): boolean {
  return role === "ADMIN" || role === "ADJUSTER";
}

export function canManagePayments(role: AdjusterRole): boolean {
  return role === "ADMIN";
}
