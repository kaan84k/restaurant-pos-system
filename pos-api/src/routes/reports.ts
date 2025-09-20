import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

// util: day range for a YYYY-MM-DD string in server local time
function dayRange(dateStr: string) {
  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function summarize(sales: Array<{
  id: number;
  subtotal_cents: number; tax_cents: number; total_cents: number;
  paid_cents: number; change_cents: number;
}>) {
  const totals = sales.reduce(
    (acc, s) => {
      acc.subtotal_cents += s.subtotal_cents;
      acc.tax_cents      += s.tax_cents;
      acc.total_cents    += s.total_cents;
      acc.paid_cents     += s.paid_cents;
      acc.change_cents   += s.change_cents;
      return acc;
    },
    { subtotal_cents: 0, tax_cents: 0, total_cents: 0, paid_cents: 0, change_cents: 0 }
  );
  return { ...totals, sales_count: sales.length };
}

const router = Router();

/**
 * GET /reports/x?date=YYYY-MM-DD&terminalId=T-1
 * Preview totals for the day for sales that are NOT closed (zReportId IS NULL).
 * Role: CASHIER+ (any logged-in user)
 */
router.get("/x", requireAuth, async (req, res, next) => {
  try {
    const date = String(req.query.date ?? "").trim();
    if (!date) return res.status(400).json({ error: "date (YYYY-MM-DD) is required" });
    const terminalId = req.query.terminalId ? String(req.query.terminalId) : undefined;
    const { start, end } = dayRange(date);

    const where: any = {
      businessDate: { gte: start, lt: end },
      zReportId: null,
    };
    if (terminalId) where.terminalId = terminalId;

    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: true, subtotal_cents: true, tax_cents: true,
        total_cents: true, paid_cents: true, change_cents: true,
      },
      orderBy: { id: "asc" },
    });

    const payments = await prisma.payment.findMany({
      where: { sale: { businessDate: { gte: start, lt: end }, zReportId: null, ...(terminalId ? { terminalId } : {}) } },
      select: { method: true, amount_cents: true },
    });
    const byMethod = new Map<string, number>();
    for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents);
    const payments_by_method = Array.from(byMethod, ([method, amount_cents]) => ({ method, amount_cents }));

    const totals = await summarize(sales);
    res.json({
      kind: "X",
      businessDate: date,
      terminalId: terminalId ?? null,
      ...totals,
      payments_by_method,
    });
  } catch (e) { next(e); }
});

/**
 * POST /reports/z  { date: "YYYY-MM-DD", terminalId?: "T-1" }
 * Closes all un-closed sales for that day (and terminal if provided),
 * writes a ZReport snapshot, and marks those sales with zReportId.
 * Role: MANAGER/ADMIN
 */
router.post("/z", requireAuth, requireRole(["MANAGER","ADMIN"]), async (req, res, next) => {
  try {
    const date = String(req.body?.date ?? "").trim();
    if (!date) return res.status(400).json({ error: "date (YYYY-MM-DD) is required" });
    const terminalId: string | undefined = req.body?.terminalId ? String(req.body.terminalId) : undefined;

    const { start, end } = dayRange(date);

    const whereSales: any = {
      businessDate: { gte: start, lt: end },
      zReportId: null,
    };
    if (terminalId) whereSales.terminalId = terminalId;

    // Get the set of sales to close
    const sales = await prisma.sale.findMany({
      where: whereSales,
      select: {
        id: true, subtotal_cents: true, tax_cents: true,
        total_cents: true, paid_cents: true, change_cents: true,
      },
      orderBy: { id: "asc" },
    });

    if (sales.length === 0) {
      return res.status(400).json({ error: "No open sales for that day/terminal" });
    }

    // Payment breakdown
    const payments = await prisma.payment.findMany({
      where: { sale: { businessDate: { gte: start, lt: end }, zReportId: null, ...(terminalId ? { terminalId } : {}) } },
      select: { method: true, amount_cents: true },
    });
    const byMethod = new Map<string, number>();
    for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents);
    const payments_by_method = Array.from(byMethod, ([method, amount_cents]) => ({ method, amount_cents }));

    const totals = await summarize(sales);

    // Create ZReport snapshot
    const z = await prisma.zReport.create({
      data: {
        businessDate: new Date(date + "T00:00:00"),
        terminalId: terminalId ?? null,
        createdBy: req.user ? Number((req.user as any).sub) : null,

        totals_subtotal_cents: totals.subtotal_cents,
        totals_tax_cents: totals.tax_cents,
        totals_total_cents: totals.total_cents,
        totals_paid_cents: totals.paid_cents,
        totals_change_cents: totals.change_cents,

        payments_by_method: payments_by_method as any,
      },
      select: { id: true },
    });

    // Lock (attach sales to this Z report)
    await prisma.sale.updateMany({
      where: whereSales,
      data: { zReportId: z.id },
    });

    res.status(201).json({ id: z.id, ...totals, payments_by_method });
  } catch (e) { next(e); }
});

/**
 * GET /z-reports?date=YYYY-MM-DD&terminalId=T-1  (list or fetch one)
 * GET /z-reports/:id                              (fetch by id)
 * Role: CASHIER+ (any logged-in user) – for reprint
 */
router.get("/z", requireAuth, async (req, res, next) => {
  try {
    if (req.query.id) {
      const id = Number(req.query.id);
      const z = await prisma.zReport.findUnique({ where: { id } });
      if (!z) return res.status(404).json({ error: "Not found" });
      return res.json(z);
    }
    const date = req.query.date ? String(req.query.date) : null;
    const terminalId = req.query.terminalId ? String(req.query.terminalId) : null;

    const where: any = {};
    if (date) {
      const { start, end } = dayRange(date);
      where.businessDate = { gte: start, lt: end };
    }
    if (terminalId) where.terminalId = terminalId;

    const zs = await prisma.zReport.findMany({
      where,
      orderBy: [{ businessDate: "desc" }, { id: "desc" }],
      take: 50,
    });
    res.json(zs);
  } catch (e) { next(e); }
});

router.get("/z/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const z = await prisma.zReport.findUnique({ where: { id } });
    if (!z) return res.status(404).json({ error: "Not found" });
    res.json(z);
  } catch (e) { next(e); }
});

export default router;
