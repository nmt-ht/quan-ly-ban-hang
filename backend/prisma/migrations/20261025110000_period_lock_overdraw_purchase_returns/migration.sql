-- AlterTable
ALTER TABLE "CompanyInfo" ADD COLUMN     "lockDate" DATE;

-- CreateTable
CREATE TABLE "PurchaseOrderReceipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "voucherId" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderReceipt_orderId_idx" ON "PurchaseOrderReceipt"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_code_key" ON "PurchaseReturn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_voucherId_key" ON "PurchaseReturn"("voucherId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_orderId_idx" ON "PurchaseReturn"("orderId");

-- CreateIndex
CREATE INDEX "SalesOrderDelivery_orderId_idx" ON "SalesOrderDelivery"("orderId");

-- AddForeignKey
ALTER TABLE "PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "WarehouseVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderDelivery" ADD CONSTRAINT "SalesOrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Quyền mới (as MISA): khoá sổ kỳ kế toán, trả lại hàng mua — CEO (chức vụ hệ thống), Quản lý, Kế toán; chi vượt tồn quỹ — CEO, Quản lý.
INSERT INTO "Permission" ("code", "module", "label") VALUES
  ('period.lock', 'company', 'Khoá sổ / bỏ khoá sổ kỳ kế toán'),
  ('purchase.return', 'purchase', 'Trả lại hàng mua'),
  ('voucher.overdraw', 'voucher', 'Chi vượt tồn quỹ')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", p.code FROM "Role" r CROSS JOIN (VALUES ('period.lock'), ('purchase.return')) AS p(code)
  WHERE r."isSystem" OR r."id" IN ('role-manager', 'role-accountant')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'voucher.overdraw' FROM "Role" r WHERE r."isSystem" OR r."id" = 'role-manager'
ON CONFLICT DO NOTHING;
