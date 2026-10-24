-- Pha 1.4 · Báo giá BG…: cùng dòng hàng như đơn bán, không đụng tồn kho hay công nợ; "Lập đơn" sao sang đơn hàng (orderId).
-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('MOI', 'DA_CHOT', 'HUY');

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "deliveryAddress" TEXT,
    "description" TEXT,
    "quoteDate" DATE NOT NULL,
    "validUntil" DATE,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "QuotationStatus" NOT NULL DEFAULT 'MOI',
    "cancelReason" TEXT,
    "orderId" TEXT,
    "salesRepId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitName" TEXT,
    "ratioToBase" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "discountRate" DECIMAL(65,30),
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "length" DECIMAL(65,30),
    "width" DECIMAL(65,30),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_code_key" ON "Quotation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_orderId_key" ON "Quotation"("orderId");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Quyền Báo giá: CEO (chức vụ hệ thống) và Quản lý mọi quyền, Sale lập/sửa/huỷ, Kế toán chỉ xem.
INSERT INTO "Permission" ("code", "module", "label") VALUES
  ('quote.view', 'quote', 'Xem báo giá'),
  ('quote.create', 'quote', 'Lập báo giá'),
  ('quote.update', 'quote', 'Sửa báo giá'),
  ('quote.cancel', 'quote', 'Huỷ báo giá')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", p.code FROM "Role" r CROSS JOIN (VALUES ('quote.view'), ('quote.create'), ('quote.update'), ('quote.cancel')) AS p(code)
  WHERE r."isSystem" OR r."id" IN ('role-manager', 'role-sale')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'quote.view' FROM "Role" r WHERE r."id" = 'role-accountant'
ON CONFLICT DO NOTHING;
