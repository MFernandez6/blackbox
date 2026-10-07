import type { PersonRole } from "@prisma/client";

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  PROPERTY_MANAGER: "Property Manager",
  ASSOCIATION_BOARD: "Association / Board",
  PUBLIC_ADJUSTER: "Public Adjuster",
  CARRIER_ADJUSTER: "Carrier Adjuster",
  INDEPENDENT_ADJUSTER: "Independent Adjuster",
  CONTRACTOR: "Contractor",
  MITIGATION: "Mitigation / Restoration",
  ENGINEER: "Engineer",
  ATTORNEY: "Attorney",
  APPRAISER: "Appraiser",
  UMPIRE: "Umpire",
  INSURANCE_AGENT: "Insurance Agent",
  VENDOR: "Vendor",
  OTHER: "Other",
};

export const PERSON_ROLES = Object.keys(PERSON_ROLE_LABELS) as PersonRole[];

export const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "Portuguese",
  "Haitian Creole",
  "French",
  "Russian",
  "Italian",
  "Mandarin",
] as const;

export const TEMPERAMENT_GROUPS: Array<{
  label: string;
  tone: "positive" | "neutral" | "caution";
  options: string[];
}> = [
  {
    label: "Works well",
    tone: "positive",
    options: [
      "Cooperative",
      "Responsive",
      "Friendly",
      "Straight shooter",
      "Detail-oriented",
      "Knowledgeable",
    ],
  },
  {
    label: "Style",
    tone: "neutral",
    options: [
      "Formal",
      "Direct",
      "Talkative",
      "Prefers phone",
      "Prefers text",
      "Prefers email",
      "Prefers in person",
      "Needs it in writing",
    ],
  },
  {
    label: "Heads-up",
    tone: "caution",
    options: [
      "Slow to respond",
      "Hard to reach",
      "Pushes back",
      "Adversarial",
      "Short-tempered",
      "Escalates quickly",
    ],
  },
];

const TEMPERAMENT_TONE = new Map(
  TEMPERAMENT_GROUPS.flatMap((g) => g.options.map((o) => [o, g.tone] as const))
);

export function temperamentTone(tag: string) {
  return TEMPERAMENT_TONE.get(tag) ?? "neutral";
}

export const TEMPERAMENT_CHIP_CLASS = {
  positive: "border-brand-gold/40 text-brand-gold",
  neutral: "border-brand-white/15 text-brand-white/75",
  caution: "border-denied/50 bg-denied-muted text-denied-soft",
} as const;
