import { z } from "zod";

export const searchProductsQuery = z.object({
  query: z.string().min(1).optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  limit: z.string().transform(v => parseInt(v)).optional()
});

export const saleItemInput = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().positive(),
  unit_cents: z.number().int().positive().optional() // optional override
});

export const createSaleBody = z.object({
  terminalId: z.string(),
  cashierId: z.string(),
  items: z.array(saleItemInput).min(1),
  payment: z.object({
    method: z.string().min(1),
    amount_cents: z.number().int().nonnegative()
  }).optional()
});

export const paymentBody = z.object({
  saleId: z.number().int().positive(),
  method: z.string().min(1),
  amount_cents: z.number().int().positive()
});
