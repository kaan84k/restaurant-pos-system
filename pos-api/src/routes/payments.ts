import { Router } from "express";
import { prisma } from "../lib/prisma";
import { paymentBody } from "../validators";

const router = Router();

/**
 * POST /payments
 * Body: { saleId, method, amount_cents }
 */
router.post("/", async (req, res) => {
  const parsed = paymentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { saleId, method, amount_cents } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId }});
      if (!sale) throw new Error("Sale not found");

      const p = await tx.payment.create({
        data: { saleId, method, amount_cents }
      });

      const paid = sale.paid_cents + amount_cents;
      const change = Math.max(paid - sale.total_cents, 0);

      const updated = await tx.sale.update({
        where: { id: saleId },
        data: { paid_cents: paid, paymentMethod: method, change_cents: change }
      });

      return { payment: p, sale: updated };
    });

    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Payment failed" });
  }
});

export default router;
