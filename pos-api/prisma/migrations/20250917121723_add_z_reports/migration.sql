-- CreateTable
CREATE TABLE "ZReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "businessDate" DATETIME NOT NULL,
    "terminalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "totals_subtotal_cents" INTEGER NOT NULL,
    "totals_tax_cents" INTEGER NOT NULL,
    "totals_total_cents" INTEGER NOT NULL,
    "totals_paid_cents" INTEGER NOT NULL,
    "totals_change_cents" INTEGER NOT NULL,
    "payments_by_method" JSONB,
    CONSTRAINT "ZReport_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
INSERT INTO "new_Sale" ("cashierId", "change_cents", "createdAt", "id", "paid_cents", "paymentMethod", "subtotal_cents", "tax_cents", "terminalId", "total_cents") SELECT "cashierId", "change_cents", "createdAt", "id", "paid_cents", "paymentMethod", "subtotal_cents", "tax_cents", "terminalId", "total_cents" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_businessDate_terminalId_zReportId_idx" ON "Sale"("businessDate", "terminalId", "zReportId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ZReport_businessDate_terminalId_idx" ON "ZReport"("businessDate", "terminalId");
