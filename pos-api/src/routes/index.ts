import { Router } from "express";
import products from "./products";
import publicPM from "./payment-methods";
import sales from "./sales";
import cors from "cors";
import auth from "./auth";
import reports from "./reports";
import kitchen from "./kitchen";

import adminProducts from "./admin.products";
import adminProductsModule from "./admin.products";
// Extract the importHandler from admin.products.ts
const importHandler = (adminProductsModule as any).router?.stack?.find((layer: any) => {
	return layer.route && layer.route.path === "/import" && layer.route.methods.post;
})?.route?.stack?.find((m: any) => m.name === "async")?.handle || undefined;
import { taxRates } from "./admin.taxRates";
import { paymentMethodsAdmin } from "./admin.paymentMethods";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
// PUBLIC endpoints used by the register
router.use("/products", products);
router.use("/payment-methods", publicPM);
router.use("/sales", sales);
router.use("/auth", auth);
router.use("/reports", reports);  
router.use("/kitchen", kitchen);

// ADMIN/MANAGER settings
router.use("/admin/products",        requireAuth, requireRole(["MANAGER","ADMIN"]), adminProducts);

// Register the import route with middleware
// This assumes importHandler is exported or accessible from admin.products
// If not, you should export it from admin.products.ts
// Example: export const importHandler = ...
// and then import { importHandler } from "./admin.products";
// For now, we will assume you want to add this route explicitly:
// router.post(
//   "/admin/products/import",
//   requireAuth,
//   requireRole(["MANAGER","ADMIN"]),
//   importHandler
// );
router.use("/admin/tax-rates",       requireAuth, requireRole(["MANAGER","ADMIN"]), taxRates);
router.use("/admin/payment-methods", requireAuth, requireRole(["MANAGER","ADMIN"]), paymentMethodsAdmin);


export default router;
