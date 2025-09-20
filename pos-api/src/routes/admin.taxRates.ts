import { Router } from "express";
import { prisma } from "../lib/prisma";

const taxRates = Router();

taxRates.get("/", async (_req, res) => {
  const items = await prisma.taxRate.findMany({ orderBy: { id: "asc" } });
  res.json(items);
});

taxRates.post("/", async (req, res) => {
  try {
    const created = await prisma.taxRate.create({ data: req.body });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Create failed" });
  }
});

taxRates.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.taxRate.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Update failed" });
  }
});

taxRates.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.taxRate.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Delete failed" });
  }
});

export { taxRates };
