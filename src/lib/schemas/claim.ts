import { z } from "zod";

export const claimStatusEnum = z.enum([
  "INTAKE",
  "UNDER_REVIEW",
  "INVESTIGATION",
  "FILED",
  "NEGOTIATING",
  "SETTLED",
  "CLOSED",
  "DENIED",
]);

export const lossTypeEnum = z.enum([
  "WIND",
  "FIRE",
  "WATER",
  "HAIL",
  "VANDALISM",
  "OTHER",
]);

export const preferredContactEnum = z.enum(["EMAIL", "PHONE", "TEXT"]);

export const docTypeEnum = z.enum([
  "POLICY",
  "ESTIMATE",
  "PHOTO",
  "CORRESPONDENCE",
  "ENGINEERING_REPORT",
  "DEMAND_LETTER",
  "OTHER",
]);

export const paymentTypeEnum = z.enum(["ADVANCE", "SETTLEMENT", "FEE"]);

export const claimantSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone is required"),
  mailingAddress: z.string().min(1, "Mailing address is required"),
  preferredContactMethod: preferredContactEnum,
  isPrimaryContact: z.boolean(),
});

export const claimPropertySchema = z.object({
  propertyAddress: z.string().min(1, "Property address is required"),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  county: z.string().min(1, "County is required"),
  lossType: lossTypeEnum,
  dateOfLoss: z.string().min(1, "Date of loss is required"),
  lossDescription: z.string().min(1, "Loss description is required"),
  isCatClaim: z.boolean().default(false),
});

export const claimPolicySchema = z.object({
  policyNumber: z.string().optional().nullable(),
  carrierName: z.string().optional().nullable(),
  estimatedValue: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
      return Number.isNaN(n) ? null : n;
    }),
});

export const fnolIntakeSchema = z
  .object({
    claimants: z
      .array(claimantSchema)
      .min(1, "At least one claimant is required")
      .refine(
        (list) => list.filter((c) => c.isPrimaryContact).length === 1,
        "Designate exactly one primary contact"
      ),
    property: claimPropertySchema,
    policy: claimPolicySchema,
  })
  .transform((data) => ({
    ...data,
    contingencyFeePercent: data.property.isCatClaim ? 10 : 20,
  }));

export const statusChangeSchema = z.object({
  newStatus: claimStatusEnum,
  note: z.string().min(1, "A note is required for status changes"),
});

export const claimantUpdateSchema = claimantSchema.extend({
  id: z.string().optional(),
});

export const claimDetailUpdateSchema = z.object({
  propertyAddress: z.string().min(1),
  zipCode: z.string().min(5),
  county: z.string().min(1),
  lossType: lossTypeEnum,
  dateOfLoss: z.string().min(1),
  lossDescription: z.string().nullable().optional(),
  policyNumber: z.string().nullable().optional(),
  carrierName: z.string().nullable().optional(),
  estimatedValue: z.union([z.string(), z.number(), z.null()]).optional(),
  isCatClaim: z.boolean(),
  assignedAdjusterId: z.string().nullable().optional(),
});

export const documentUploadMetaSchema = z.object({
  claimId: z.string().min(1),
  docType: docTypeEnum,
});

export const paymentCreateSchema = z.object({
  claimId: z.string().min(1),
  type: paymentTypeEnum,
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1),
  note: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type ClaimantInput = z.infer<typeof claimantSchema>;
export type ClaimPropertyInput = z.infer<typeof claimPropertySchema>;
export type ClaimPolicyInput = z.infer<typeof claimPolicySchema>;
export type FnolIntakeInput = z.input<typeof fnolIntakeSchema>;
export type FnolIntakeParsed = z.output<typeof fnolIntakeSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type ClaimDetailUpdateInput = z.infer<typeof claimDetailUpdateSchema>;
