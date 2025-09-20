import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signUser } from "../lib/auth";


const router = Router();
const loginBody = z.object({ pin: z.string().min(4).max(12) });


// Login by PIN (matches any active user)
router.post("/login", async (req, res) => {
const parsed = loginBody.safeParse(req.body);
if (!parsed.success) return res.status(400).json(parsed.error.flatten());
const pin = parsed.data.pin;


const users = await prisma.user.findMany({ where: { is_active: true } });
let found: typeof users[number] | null = null;
for (const u of users) {
if (await bcrypt.compare(pin, u.pinHash)) { found = u; break; }
}
if (!found) return res.status(401).json({ error: "Invalid PIN" });


const token = signUser({ id: found.id, name: found.name, role: found.role });
res.json({ token, user: { id: found.id, name: found.name, role: found.role } });
});


// Manager override check (no token issued)
router.post("/check-pin", async (req, res) => {
const parsed = loginBody.safeParse(req.body);
if (!parsed.success) return res.status(400).json(parsed.error.flatten());
const pin = parsed.data.pin;


const users = await prisma.user.findMany({ where: { is_active: true } });
for (const u of users) {
if (await bcrypt.compare(pin, u.pinHash)) {
return res.json({ ok: true, user: { id: u.id, name: u.name, role: u.role } });
}
}
return res.status(401).json({ ok: false, error: "Invalid PIN" });
});


export default router;