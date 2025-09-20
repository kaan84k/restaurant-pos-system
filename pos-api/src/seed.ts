import { prisma } from "./lib/prisma";
import bcrypt from "bcryptjs";

async function u(name: string, role: "ADMIN"|"MANAGER"|"CASHIER", pin: string, id: number){
  const pinHash = await bcrypt.hash(pin, 10);
  await prisma.user.upsert({
    where: { id },
    update: { name, role, is_active: true, pinHash },
    create: { id, name, role: role as any, is_active: true, pinHash }
  });
}

async function main() {
  // Upsert VAT (15% = 1500 basis points)
  const vat = await prisma.taxRate.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "VAT 15%", rate_bps: 1500 }
  });

  // Idempotent product seeding via upsert (unique by sku)
  const products = [
    { sku: "TEA001", name: "Milk Tea",        price_cents: 2500,  taxRateId: vat.id, barcode: null as string | null },
    { sku: "SND001", name: "Chicken Sandwich",price_cents: 12000, taxRateId: vat.id, barcode: "8901234567890" },
    { sku: "WTR500", name: "Water 500ml",     price_cents: 800,   taxRateId: null,   barcode: null }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        price_cents: p.price_cents,
        taxRateId: p.taxRateId ?? null,
        barcode: p.barcode
      },
      create: p
    });
  }

  // User seeding
  await u("Admin", "ADMIN", "9999", 1);
  await u("Manager", "MANAGER", "2222", 2);
  await u("Cashier", "CASHIER", "1111", 3);
  console.log("Users seeded: Admin(9999), Manager(2222), Cashier(1111)");

  console.log("Seeded.");
}

main().finally(async () => prisma.$disconnect());
