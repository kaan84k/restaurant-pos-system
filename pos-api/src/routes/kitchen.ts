import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { KitchenStatus } from "@prisma/client";
import { z } from "zod";

const router = Router();

router.use(requireAuth);

function parseDateParam(value: unknown): { start: Date; end: Date } {
  const dateStr = typeof value === "string" && value.trim() ? value.trim() : null;
  const base = dateStr ?? new Date().toISOString().slice(0, 10);
  const match = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  const [, yy, mm, dd] = match;
  const start = new Date(Number(yy), Number(mm) - 1, Number(dd));
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function mapSale(sale: any) {
  return {
    id: sale.id,
    orderCode: sale.orderCode,
    terminalId: sale.terminalId,
    createdAt: sale.createdAt,
    businessDate: sale.businessDate,
    kitchenStatus: sale.kitchenStatus,
    kitchenCompletedAt: sale.kitchenCompletedAt,
    items: sale.items.map((item: any) => ({
      id: item.id,
      qty: item.qty,
      productId: item.productId,
      name: item.product.name,
    })),
  };
}

router.get("/orders", async (req, res, next) => {
  try {
    const { start, end } = parseDateParam(req.query.date);
    const statusRaw =
      typeof req.query.status === "string" ? req.query.status.toUpperCase() : "ALL";
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.trunc(limitRaw), 200)
      : 100;

    const where: any = {
      businessDate: { gte: start, lt: end },
    };

    if (statusRaw === KitchenStatus.PENDING || statusRaw === KitchenStatus.COMPLETED) {
      where.kitchenStatus = statusRaw;
    }

    const orderBy = statusRaw === KitchenStatus.COMPLETED
      ? { kitchenCompletedAt: "desc" as const }
      : { createdAt: "asc" as const };

    const sales = await prisma.sale.findMany({
      where,
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy,
      take: limit,
    });

    res.json({ orders: sales.map(mapSale) });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  kitchenStatus: z.enum([KitchenStatus.PENDING, KitchenStatus.COMPLETED]).optional(),
});

router.patch(
  "/orders/:id",
  requireRole(["MANAGER", "ADMIN"]),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid order id" });
      }

      const parsed = updateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const nextStatus = parsed.data.kitchenStatus ?? KitchenStatus.COMPLETED;
      const updated = await prisma.sale.update({
        where: { id },
        data: {
          kitchenStatus: nextStatus,
          kitchenCompletedAt:
            nextStatus === KitchenStatus.COMPLETED ? new Date() : null,
        },
        include: { items: { include: { product: { select: { name: true } } } } },
      });

      res.json({ order: mapSale(updated) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
