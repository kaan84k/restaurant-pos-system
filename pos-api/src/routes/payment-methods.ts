import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const items = await prisma.paymentMethod.findMany({
    where: { is_active: true },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
  });
  res.json(items);
});

export default router;
