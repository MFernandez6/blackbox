import type { PersonRole, PreferredContactMethod } from "@prisma/client";

export type PersonFormValues = {
  name: string;
  title: string;
  company: string;
  role: PersonRole;
  mobilePhone: string;
  officePhone: string;
  email: string;
  website: string;
  address: string;
  languages: string[];
  preferredContactMethod: PreferredContactMethod | null;
  bestTimeToReach: string;
  temperament: string[];
  notes: string;
};

export const EMPTY_PERSON: PersonFormValues = {
  name: "",
  title: "",
  company: "",
  role: "OTHER",
  mobilePhone: "",
  officePhone: "",
  email: "",
  website: "",
  address: "",
  languages: [],
  preferredContactMethod: null,
  bestTimeToReach: "",
  temperament: [],
  notes: "",
};

export type PersonSummary = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  role: PersonRole;
  mobilePhone: string | null;
  officePhone: string | null;
  email: string | null;
  languages: string[];
  temperament: string[];
};

export type PersonDetail = PersonSummary & {
  website: string | null;
  address: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  bestTimeToReach: string | null;
  notes: string | null;
  hasCard: boolean;
  createdByName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toFormValues(p: PersonDetail): PersonFormValues {
  return {
    name: p.name,
    title: p.title ?? "",
    company: p.company ?? "",
    role: p.role,
    mobilePhone: p.mobilePhone ?? "",
    officePhone: p.officePhone ?? "",
    email: p.email ?? "",
    website: p.website ?? "",
    address: p.address ?? "",
    languages: p.languages,
    preferredContactMethod: p.preferredContactMethod,
    bestTimeToReach: p.bestTimeToReach ?? "",
    temperament: p.temperament,
    notes: p.notes ?? "",
  };
}
