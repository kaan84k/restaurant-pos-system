import { Router } from "express";
import { prisma } from "../lib/prisma";

const paymentMethodsAdmin = Router();

paymentMethodsAdmin.get("/", async (_req, res) => {
  const items = await prisma.paymentMethod.findMany({
    orderBy: [{ sort: "asc" }, { code: "asc" }],
  });
  res.json(items);
});

paymentMethodsAdmin.post("/", async (req, res) => {
  try {
    const created = await prisma.paymentMethod.create({ data: req.body });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Create failed" });
  }
});

paymentMethodsAdmin.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.paymentMethod.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Update failed" });
  }
});

paymentMethodsAdmin.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.paymentMethod.delete({ where: { id } });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Delete failed" });
  }
  res.status(204).send();
});

export { paymentMethodsAdmin };
