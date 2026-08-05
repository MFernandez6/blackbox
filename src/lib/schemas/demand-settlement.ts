import { z } from "zod";

const moneyOptional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
    return Number.isNaN(n) ? null : n;
  });

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v : null));

export const demandSettlementUpdateSchema = z.object({
  demandAmount: moneyOptional,
  demandSentDate: optionalDate,
  rcvAmount: moneyOptional,
  acvAmount: moneyOptional,
  settlementAmount: moneyOptional,
  settlementDate: optionalDate,
  settlementNotes: z.string().optional().nullable(),
});

export type DemandSettlementUpdateInput = z.infer<
  typeof demandSettlementUpdateSchema
>;
