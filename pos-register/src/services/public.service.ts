// src/services/public.service.ts
import { apiGet } from "./api";
import type { Product, PaymentMethod } from "./admin.service";

export type PublicProduct = Product & {
  taxRate?: { id: number; name: string; rate_bps: number } | null;
};

export const PublicAPI = {
  searchProducts: (query: string) =>
    apiGet<PublicProduct[]>("/products", { query }),     // or { q: query } if your API uses ?q
  lookupBarcode:  (barcode: string) =>
    apiGet<PublicProduct[]>("/products", { barcode }),
  paymentMethods: () =>
    apiGet<PaymentMethod[]>("/payment-methods"),
};