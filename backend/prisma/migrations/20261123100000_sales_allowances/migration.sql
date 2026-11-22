-- Giảm giá hàng bán: phiếu GG…, TK 521 (5211 chiết khấu thương mại, 5212 hàng bán bị trả lại, 5213 giảm giá hàng bán),
-- quyền gộp với "Nhận hàng trả lại" (order.return).

-- Danh mục cho cơ sở dữ liệu ĐÃ CÓ người dùng (khớp prisma/seed.ts); chạy lại an toàn.
INSERT INTO "Account" ("code", "name", "parentCode", "kind", "normalSide", "isDetail") VALUES
  ('521', 'Các khoản giảm trừ doanh thu', NULL, 'DOANH_THU', 'NO', false),
  ('5211', 'Chiết khấu thương mại', '521', 'DOANH_THU', 'NO', true),
  ('5212', 'Hàng bán bị trả lại', '521', 'DOANH_THU', 'NO', true),
  ('5213', 'Giảm giá hàng bán', '521', 'DOANH_THU', 'NO', true)
ON CONFLICT ("code") DO NOTHING;

UPDATE "Permission" SET "label" = 'Nhận hàng trả lại, giảm giá hàng bán' WHERE "code" = 'order.return';

-- CreateTable
CREATE TABLE "SalesAllowance" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "taxable" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAllowanceLine" (
    "id" TEXT NOT NULL,
    "allowanceId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "taxable" DECIMAL(65,30) NOT NULL,
    "vat" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesAllowanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesAllowance_code_key" ON "SalesAllowance"("code");

-- CreateIndex
CREATE INDEX "SalesAllowance_orderId_idx" ON "SalesAllowance"("orderId");

-- AddForeignKey
ALTER TABLE "SalesAllowance" ADD CONSTRAINT "SalesAllowance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAllowanceLine" ADD CONSTRAINT "SalesAllowanceLine_allowanceId_fkey" FOREIGN KEY ("allowanceId") REFERENCES "SalesAllowance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
