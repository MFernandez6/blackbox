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

/** Tailwind classes for status badges — deep red reserved for DENIED */
export const STATUS_BADGE_CLASS: Record<ClaimStatus, string> = {
  INTAKE: "border-[#2A2A2A] text-[#F5F5F0]/80",
  UNDER_REVIEW: "border-[#3A3A3A] text-[#F5F5F0]",
  INVESTIGATION: "border-[#4A4A4A] text-[#F5F5F0]",
  FILED: "border-[#5A5A5A] text-[#F5F5F0]",
  NEGOTIATING: "border-[#6A6A6A] text-[#F5F5F0]",
  SETTLED: "border-[#F5F5F0]/40 text-[#F5F5F0]",
  CLOSED: "border-[#2A2A2A] text-[#F5F5F0]/50",
  DENIED: "border-[#8B0000] bg-[#8B0000]/20 text-[#F5F5F0]",
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
