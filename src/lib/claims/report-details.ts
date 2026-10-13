export const OCCUPANCY_OPTIONS = [
  { value: "OWNER_OCCUPIED", label: "Owner-occupied", phrase: "owner-occupied as the insured's primary residence" },
  { value: "TENANT_OCCUPIED", label: "Tenant-occupied", phrase: "tenant-occupied" },
  { value: "SEASONAL", label: "Seasonal / secondary", phrase: "a seasonal or secondary residence for the insured" },
  { value: "VACANT", label: "Vacant", phrase: "vacant" },
] as const;

export const MITIGATION_ENGAGED_OPTIONS = [
  { value: "INSURED", label: "Insured (selected / contracted)" },
  { value: "PUBLIC_ADJUSTER", label: "PA (selected / contracted)" },
  { value: "CARRIER", label: "Carrier (provided)" },
  { value: "NONE", label: "None used" },
] as const;

export type OccupancyValue = (typeof OCCUPANCY_OPTIONS)[number]["value"];
export type MitigationEngagedValue = (typeof MITIGATION_ENGAGED_OPTIONS)[number]["value"];

/** Serialized for the client: dates as yyyy-mm-dd, unknown booleans as null. */
export type ClaimReportDetails = {
  certifiedPolicyRequestedDate: string | null;
  certifiedPolicyReceivedDate: string | null;
  dwellingType: string | null;
  stories: number | null;
  constructionType: string | null;
  roofCovering: string | null;
  yearBuilt: number | null;
  occupancy: string | null;
  inspectionAttendees: string | null;
  originOfLoss: string | null;
  priorLosses: string | null;
  moldObserved: boolean | null;
  contentsDamaged: boolean | null;
  mitigationCompany: string | null;
  mitigationEngagedBy: string | null;
  mitigationStartDate: string | null;
  mitigationServices: string | null;
  homeHabitable: boolean | null;
  aleDetails: string | null;
  subrogationNotes: string | null;
};
