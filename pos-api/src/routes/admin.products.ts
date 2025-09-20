// pos-api/src/routes/admin.products.ts
import multer from "multer";
import type { Request } from "express";
interface MulterRequest extends Request { file?: Express.Multer.File; }

import { parse } from "csv-parse/sync";
import { z } from "zod";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// ───────────────────────────── GET /admin/products
router.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const onlyActive = String(req.query.onlyActive ?? "") === "true";

  const items = await prisma.product.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name:    { contains: q } },
                { sku:     { contains: q } },
                { barcode: { contains: q } },
              ],
            }
          : {},
        onlyActive ? { is_active: true } : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  res.json(items);
});

// ───────────────────────────── POST /admin/products
router.post("/", async (req, res) => {
  try {
    const { sku, name, barcode = null, price_cents, taxRateId = null, is_active = true } = req.body ?? {};
    const created = await prisma.product.create({
      data: {
        sku,
        name,
        barcode,
        price_cents: Number(price_cents),
        taxRateId: taxRateId ?? null,
        is_active: Boolean(is_active),
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Create failed" });
  }
});

// ───────────────────────────── PUT /admin/products/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.product.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Update failed" });
  }
});

// ───────────────────────────── DELETE /admin/products/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    // If you hit FK constraints from sales, surface a clearer message:
    if (String(e?.message || "").toLowerCase().includes("foreign key")) {
      return res.status(409).json({ error: "Cannot delete: product is referenced by sales." });
    }
    res.status(400).json({ error: e?.message || "Delete failed" });
  }
});

// ───────────────────────────── Unified /import (CSV or JSON)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const CsvRow = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  barcode: z.string().optional().nullable(),
  price: z.string().optional().nullable(),           // "25.00"
  price_cents: z.string().optional().nullable(),     // "2500"
  tax_rate_name: z.string().optional().nullable(),   // matches TaxRate.name (optional)
  is_active: z.string().optional().nullable(),       // true/false/1/0/yes/no
});

function toCents(row: z.infer<typeof CsvRow>): number {
  if (row.price_cents && row.price_cents.trim() !== "") {
    const cents = Number(row.price_cents);
    if (!Number.isFinite(cents)) throw new Error("Invalid price_cents");
    return Math.round(cents);
  }
  if (row.price && row.price.trim() !== "") {
    const v = parseFloat(row.price.replace(/,/g, ""));
    if (!Number.isFinite(v)) throw new Error("Invalid price");
    return Math.round(v * 100);
  }
  throw new Error("Missing price/price_cents");
}
function toBool(s?: string | null): boolean {
  if (s == null || s === "") return true; // default to active
  return /^true|1|yes|y$/i.test(s.trim());
}

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    // If a CSV file was uploaded (multipart/form-data)
    const mreq = req as MulterRequest;
    if (mreq.file) {
      const text = mreq.file.buffer.toString("utf8");
      const records: any[] = parse(text, { columns: true, skip_empty_lines: true, trim: true });

      const rates = await prisma.taxRate.findMany();
      const rateMap = new Map<string, number>();
      for (const r of rates) rateMap.set(r.name.toLowerCase(), r.id);

      let created = 0, updated = 0;
      const errors: Array<{ row: number; sku?: string; error: string }> = [];

      for (let i = 0; i < records.length; i++) {
        const raw = records[i];
        try {
          const row = CsvRow.parse({
            sku: raw.sku,
            name: raw.name,
            barcode: raw.barcode ?? "",
            price: raw.price ?? "",
            price_cents: raw.price_cents ?? "",
            tax_rate_name: raw.tax_rate_name ?? raw.taxRateName ?? "",
            is_active: raw.is_active ?? "",
          });

          const price_cents = toCents(row);
          const is_active = toBool(row.is_active);
          const taxRateId = row.tax_rate_name
            ? rateMap.get(row.tax_rate_name.toLowerCase()) ?? null
            : null;

          const exists = await prisma.product.findUnique({ where: { sku: row.sku } });
          if (!exists) {
            await prisma.product.create({
              data: {
                sku: row.sku,
                name: row.name,
                barcode: row.barcode ? row.barcode : null,
                price_cents,
                taxRateId,
                is_active,
              },
            });
            created++;
          } else {
            await prisma.product.update({
              where: { sku: row.sku },
              data: {
                name: row.name,
                barcode: row.barcode ? row.barcode : null,
                price_cents,
                taxRateId,
                is_active,
                updatedAt: new Date(),
              },
            });
            updated++;
          }
        } catch (e: any) {
          errors.push({ row: i + 2, sku: raw?.sku, error: e?.message ?? String(e) });
        }
      }
      return res.json({ ok: true, created, updated, errors });
    }

    // Otherwise, expect JSON: { items: [...] }
    const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "items[] required" });

    // Optional: whitelist fields to avoid stray props
    const clean = items.map((p) => ({
      sku: p.sku,
      name: p.name,
      barcode: p.barcode ?? null,
      price_cents: Number(p.price_cents),
      taxRateId: p.taxRateId ?? null,
      is_active: p.is_active ?? true,
    }));

    let created = 0, updated = 0;
    for (const p of clean) {
      const exists = await prisma.product.findUnique({ where: { sku: p.sku } });
      if (!exists) { await prisma.product.create({ data: p }); created++; }
      else { await prisma.product.update({ where: { sku: p.sku }, data: { ...p, updatedAt: new Date() } }); updated++; }
    }
    return res.json({ ok: true, created, updated, errors: [] });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? "Import failed" });
  }
});

export default router;
