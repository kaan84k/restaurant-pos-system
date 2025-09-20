import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req, res) => {
  const term = String(req.query.query ?? req.query.q ?? "").trim();
  const sku = String(req.query.sku ?? "").trim();
  const barcode = String(req.query.barcode ?? "").trim();

  const where: any = { is_active: true };

  if (sku) where.sku = sku;
  if (barcode) where.barcode = barcode;
  if (term) {
    where.OR = [
      { name: { contains: term } },
      { sku: { contains: term } },
      { barcode: { contains: term } },
    ];
  }

  const items = await prisma.product.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], // if you don't have updatedAt, use { id: "desc" }
    take: 50,
    include: { taxRate: true },
  });

  res.json(items);
});

export default router;
