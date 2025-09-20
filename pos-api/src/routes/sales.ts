// pos-api/src/routes/sales.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";
// import { requireAuth } from "../middleware/auth"; // enable if you want

const router = Router();

// Helper: get local midnight "business day" (use server local time or hard-code Asia/Colombo if you prefer)
function todayMidnight(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d;
}

router.post("/", /* requireAuth, */ async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const rawItems: any[] = body.items ?? body.sale_items ?? [];
    const rawPays: any[]  = body.payments ?? body.tenders ?? [];

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: "items[] required" });
    }
    if (!Array.isArray(rawPays) || rawPays.length === 0) {
      return res.status(400).json({ error: "payments[] required" });
    }

    // Load products (for unit price + tax rate if not supplied)
    const productIds = Array.from(new Set(rawItems.map(i => Number(i.productId ?? i.product_id))));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { taxRate: true },
    });
    const productById = new Map(products.map(p => [p.id, p]));

    // Build items to match SaleItem model
    const items = rawItems.map(r => {
      const productId = Number(r.productId ?? r.product_id);
      const qty = Number(r.quantity ?? r.qty ?? 1);
      if (!productId || !qty) throw new Error("Each item needs productId and quantity/qty");

      const p = productById.get(productId);
      if (!p) throw new Error(`Product ${productId} not found`);

      const unit_cents = Number(r.unit_cents ?? r.unit_price_cents ?? p.price_cents);
      const rate_bps   = Number(r.tax_rate_bps ?? r.taxRateBps ?? p.taxRate?.rate_bps ?? 0);
      if (!Number.isFinite(unit_cents)) throw new Error("unit_cents invalid");

      const line_subtotal_cents = unit_cents * qty;
      const tax_cents = Math.round((line_subtotal_cents * rate_bps) / 10000);
      const line_total_cents = line_subtotal_cents + tax_cents;

      return {
        // Prisma expects a relation, not productId column here:
        product: { connect: { id: productId } },
        qty,
        unit_cents,
        tax_cents,
        line_total_cents,
      };
    });

    const subtotal_cents = items.reduce((s, i) => s + (i.unit_cents * i.qty), 0);
    const tax_cents      = items.reduce((s, i) => s + i.tax_cents, 0);
    const total_cents    = subtotal_cents + tax_cents;

    // Payment.method is a STRING. We accept either methodId (then we look up code),
    // or direct method string (method / method_code / method_name).
    const methodIds = Array.from(new Set(
      rawPays.map(p => Number(p.methodId ?? p.method_id)).filter(Boolean)
    ));
    const methods = methodIds.length
      ? await prisma.paymentMethod.findMany({ where: { id: { in: methodIds } } })
      : [];
    const pmById = new Map(methods.map(m => [m.id, m]));

    const payments = rawPays.map(p => {
      const amount_cents = Number(p.amount_cents ?? p.amountCents ?? p.amount);
      if (!Number.isFinite(amount_cents)) throw new Error("payments[].amount_cents required");

      const methodId = Number(p.methodId ?? p.method_id);
      let method: string | undefined =
        p.method ??
        p.method_code ??
        p.method_name ??
        (methodId ? (pmById.get(methodId)?.code ?? pmById.get(methodId)?.label) : undefined);

      if (!method) throw new Error("payments[].method (string) or methodId required");

      return { method, amount_cents };
    });

    const paid_cents = payments.reduce((s, p) => s + p.amount_cents, 0);
    if (paid_cents < total_cents) {
      return res.status(400).json({ error: `paid (${paid_cents}) is less than total (${total_cents})` });
    }
    const change_cents = paid_cents - total_cents;

    // Terminal/cashier (strings). Pull from body, or JWT if you have it.
    const terminalId = String(body.terminalId ?? body.terminal_id ?? "T-1");
    const cashierId  = String((req as any)?.user?.sub ?? body.cashierId ?? body.cashier_id ?? "0");

    const sale = await prisma.sale.create({
      data: {
        terminalId,
        cashierId,
        businessDate: todayMidnight(), // <-- add this
        subtotal_cents,
        tax_cents,
        total_cents,
        paid_cents,
        paymentMethod: payments[0]?.method ?? null, // primary method for convenience
        change_cents,
        items:    { create: items },
        payments: { create: payments },
      },
      select: { id: true },
    });

    res.status(201).json({ id: sale.id });
  } catch (err) {
    next(err);
  }
});

export default router;