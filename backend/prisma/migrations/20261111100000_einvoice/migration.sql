-- Hoá đơn điện tử: thiết lập nhà cung cấp, hoá đơn đã gửi (gốc / điều chỉnh / thay thế), quyền.
-- CreateTable
CREATE TABLE "EInvoiceSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "baseUrl" TEXT,
    "username" TEXT,
    "secretSealed" TEXT,
    "templateCode" TEXT NOT NULL DEFAULT '1',
    "series" TEXT,
    "autoEmail" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoiceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "returnId" TEXT,
    "originalId" TEXT,
    "partnerKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "templateCode" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "number" TEXT,
    "taxAuthorityCode" TEXT,
    "lookupCode" TEXT,
    "issueDate" DATE NOT NULL,
    "buyer" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "taxable" DECIMAL(65,30) NOT NULL,
    "vat" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "currency" TEXT,
    "exchangeRate" DECIMAL(65,30),
    "totalFx" DECIMAL(65,30),
    "reason" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextPollAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_partnerKey_key" ON "EInvoice"("partnerKey");

-- CreateIndex
CREATE INDEX "EInvoice_orderId_idx" ON "EInvoice"("orderId");

-- CreateIndex
CREATE INDEX "EInvoice_status_nextPollAt_idx" ON "EInvoice"("status", "nextPollAt");

-- CreateIndex
CREATE INDEX "EInvoice_issueDate_idx" ON "EInvoice"("issueDate");

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SalesOrderDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SalesReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_originalId_fkey" FOREIGN KEY ("originalId") REFERENCES "EInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One live hoá đơn gốc per đợt giao, one per whole đơn (no đợt), and one live điều chỉnh per phiếu trả hàng. A FAILED
-- attempt does not count: it can be tried again. (Partial indexes: Prisma cannot declare them — keep them here.)
CREATE UNIQUE INDEX "EInvoice_live_delivery_key" ON "EInvoice"("deliveryId")
  WHERE "kind" = 'ORIGINAL' AND "deliveryId" IS NOT NULL AND "status" <> 'FAILED';
CREATE UNIQUE INDEX "EInvoice_live_order_key" ON "EInvoice"("orderId")
  WHERE "kind" = 'ORIGINAL' AND "deliveryId" IS NULL AND "status" <> 'FAILED';
CREATE UNIQUE INDEX "EInvoice_live_return_key" ON "EInvoice"("returnId")
  WHERE "kind" = 'ADJUST' AND "returnId" IS NOT NULL AND "status" <> 'FAILED';

-- Quyền: xem hoá đơn điện tử (CEO, Quản lý, Kế toán, Sale), phát hành / điều chỉnh / thay thế (CEO, Quản lý, Kế toán),
-- thiết lập nhà cung cấp (CEO, Quản lý).
INSERT INTO "Permission" ("code", "module", "label") VALUES
  ('einvoice.view', 'einvoice', 'Xem hoá đơn điện tử'),
  ('einvoice.issue', 'einvoice', 'Phát hành, điều chỉnh, thay thế hoá đơn điện tử'),
  ('einvoice.settings', 'einvoice', 'Thiết lập kết nối hoá đơn điện tử')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", p.code FROM "Role" r CROSS JOIN (VALUES ('einvoice.view'), ('einvoice.issue')) AS p(code)
  WHERE r."isSystem" OR r."id" IN ('role-manager', 'role-accountant')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'einvoice.view' FROM "Role" r WHERE r."id" = 'role-sale'
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'einvoice.settings' FROM "Role" r WHERE r."isSystem" OR r."id" = 'role-manager'
ON CONFLICT DO NOTHING;
