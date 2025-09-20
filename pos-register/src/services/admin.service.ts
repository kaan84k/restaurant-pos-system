// src/services/admin.service.ts

export type TaxRate = { id: number; name: string; rate_bps: number };

export type Product = {
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  price_cents: number;
  taxRateId: number | null;
  is_active: boolean;
  // Include related taxRate if API returns it (optional; UI handles absence)
  taxRate?: TaxRate | null;
};

export type PaymentMethod = {
  id: number;
  code: string;
  label: string;
  is_active: boolean;
  opens_drawer: boolean;
  sort: number;
};

import { apiGet, apiPost, apiPut, apiDel, apiPostForm } from "./api";

/**
 * PRODUCTS (admin)
 * - list supports search + include archived (inactive) items
 * - archive/restore (soft delete) + hardDelete
 * - importProducts: CSV upload (multipart/form-data)
 */
export const AdminProducts = {
  /**
   * List products. When includeInactive=true, the API should return archived/inactive ones as well.
   * Your API router should read `q` and `include_inactive=1` (presence-based is fine).
   */
  list: (q = "", includeInactive = false) =>
    apiGet<Product[]>("/admin/products", {
      ...(q ? { q } : {}),
      ...(includeInactive ? { include_inactive: "1" } : {}),
    }),

  create: (p: Partial<Product>) => apiPost<Product>("/admin/products", p),

  update: (id: number, p: Partial<Product>) =>
    apiPut<Product>(`/admin/products/${id}`, p),

  /** Soft delete (archive) — expects POST /admin/products/:id/archive */
  archive: (id: number) => apiPost(`/admin/products/${id}/archive`, {}),

  /** Restore — expects POST /admin/products/:id/restore */
  restore: (id: number) => apiPost(`/admin/products/${id}/restore`, {}),

  /**
   * Hard delete — only if no FK usage (sales line items). The UI guards this and shows a
   * friendly message if the API returns a FK error.
   */
  hardDelete: (id: number) => apiDel(`/admin/products/${id}`),

  /**
   * CSV import (multipart). API endpoint: POST /admin/products/import
   * Returns { ok, created, updated, errors[] }
   */
  importProducts: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiPostForm<{
      ok: boolean;
      created: number;
      updated: number;
      errors: { row: number; sku?: string; error: string }[];
    }>("/admin/products/import", fd);
  },
};

/**
 * TAX RATES (admin)
 */
export const AdminTax = {
  list: () => apiGet<TaxRate[]>("/admin/tax-rates"),
  create: (t: Partial<TaxRate>) => apiPost<TaxRate>("/admin/tax-rates", t),
  update: (id: number, t: Partial<TaxRate>) =>
    apiPut<TaxRate>(`/admin/tax-rates/${id}`, t),
  remove: (id: number) => apiDel(`/admin/tax-rates/${id}`),
};

/**
 * PAYMENT METHODS (admin)
 */
export const AdminPM = {
  list: () => apiGet<PaymentMethod[]>("/admin/payment-methods"),
  create: (p: Partial<PaymentMethod>) =>
    apiPost<PaymentMethod>("/admin/payment-methods", p),
  update: (id: number, p: Partial<PaymentMethod>) =>
    apiPut<PaymentMethod>(`/admin/payment-methods/${id}`, p),
  remove: (id: number) => apiDel(`/admin/payment-methods/${id}`),
};
