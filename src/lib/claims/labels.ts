import type {
  ClaimStatus,
  LossType,
  DocType,
  PaymentType,
  PreferredContactMethod,
} from "@prisma/client";

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  INTAKE: "Intake",
  UNDER_REVIEW: "Under Review",
  INVESTIGATION: "Investigation",
  FILED: "Filed",
  NEGOTIATING: "Negotiating",
  SETTLED: "Settled",
  CLOSED: "Closed",
  DENIED: "Denied",
};

/** Tailwind classes for status badges — deep red reserved for DENIED; gold for active pipeline */
export const STATUS_BADGE_CLASS: Record<ClaimStatus, string> = {
  INTAKE: "border-brand-white/15 text-brand-white/70",
  UNDER_REVIEW: "border-brand-gold/30 text-brand-gold/90",
  INVESTIGATION: "border-brand-gold/45 text-brand-gold",
  FILED: "border-brand-white/25 text-brand-white",
  NEGOTIATING: "border-brand-gold/60 bg-brand-gold/10 text-brand-gold",
  SETTLED: "border-brand-white/40 text-brand-white",
  CLOSED: "border-brand-white/10 text-brand-slate",
  DENIED: "border-denied bg-denied/20 text-brand-white",
};

export const LOSS_TYPE_LABELS: Record<LossType, string> = {
  WIND: "Wind",
  FIRE: "Fire",
  WATER: "Water",
  HAIL: "Hail",
  VANDALISM: "Vandalism",
  OTHER: "Other",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  POLICY: "Policy",
  ESTIMATE: "Estimate",
  PHOTO: "Photo",
  CORRESPONDENCE: "Correspondence",
  ENGINEERING_REPORT: "Engineering Report",
  DEMAND_LETTER: "Demand Letter",
  OTHER: "Other",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ADVANCE: "Advance",
  SETTLEMENT: "Settlement",
  FEE: "Fee",
};

export const CONTACT_METHOD_LABELS: Record<PreferredContactMethod, string> = {
  EMAIL: "Email",
  PHONE: "Phone",
  TEXT: "Text",
};

export const OPEN_STATUSES: ClaimStatus[] = [
  "INTAKE",
  "UNDER_REVIEW",
  "INVESTIGATION",
  "FILED",
  "NEGOTIATING",
];
