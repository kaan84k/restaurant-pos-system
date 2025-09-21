-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderCode" TEXT,
    "kitchenStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kitchenCompletedAt" DATETIME,
    "terminalId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "paid_cents" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "change_cents" INTEGER NOT NULL DEFAULT 0,
    "zReportId" INTEGER,
    CONSTRAINT "Sale_zReportId_fkey" FOREIGN KEY ("zReportId") REFERENCES "ZReport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("businessDate", "cashierId", "change_cents", "createdAt", "id", "paid_cents", "paymentMethod", "subtotal_cents", "tax_cents", "terminalId", "total_cents", "zReportId") SELECT "businessDate", "cashierId", "change_cents", "createdAt", "id", "paid_cents", "paymentMethod", "subtotal_cents", "tax_cents", "terminalId", "total_cents", "zReportId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_orderCode_key" ON "Sale"("orderCode");
CREATE INDEX "Sale_businessDate_terminalId_zReportId_idx" ON "Sale"("businessDate", "terminalId", "zReportId");
CREATE INDEX "Sale_businessDate_kitchenStatus_idx" ON "Sale"("businessDate", "kitchenStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
