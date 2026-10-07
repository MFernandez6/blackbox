import { z } from "zod";
import { preferredContactEnum } from "@/lib/schemas/claim";

export const personRoleEnum = z.enum([
  "PROPERTY_MANAGER",
  "ASSOCIATION_BOARD",
  "PUBLIC_ADJUSTER",
  "CARRIER_ADJUSTER",
  "INDEPENDENT_ADJUSTER",
  "CONTRACTOR",
  "MITIGATION",
  "ENGINEER",
  "ATTORNEY",
  "APPRAISER",
  "UMPIRE",
  "INSURANCE_AGENT",
  "VENDOR",
  "OTHER",
]);

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const personInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  title: optionalText(120),
  company: optionalText(160),
  role: personRoleEnum,
  mobilePhone: optionalText(40),
  officePhone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Enter a valid email",
    })
    .transform((v) => (v ? v.toLowerCase() : null)),
  website: optionalText(200),
  address: optionalText(300),
  languages: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  preferredContactMethod: preferredContactEnum.optional().nullable(),
  bestTimeToReach: optionalText(120),
  temperament: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: optionalText(5000),
});

export type PersonInput = z.input<typeof personInputSchema>;

export const personCreateSchema = personInputSchema.extend({
  /** Link the new person to this claim in the same step */
  claimId: z.string().min(1).optional().nullable(),
  roleOnFile: optionalText(160),
  /** Skip the possible-duplicate check */
  allowDuplicate: z.boolean().optional(),
});

export const claimPersonLinkSchema = z.object({
  claimId: z.string().min(1),
  personId: z.string().min(1),
  roleOnFile: optionalText(160),
});
