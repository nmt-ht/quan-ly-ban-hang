-- Chi phí mua hàng phân bổ vào giá nhập: hoá đơn mua hàng (HM…) có thể gắn một đơn nhập, các dòng "GIA_NHAP" cộng vào giá trị hàng đã nhận.

-- AlterTable
ALTER TABLE "PurchaseBill" ADD COLUMN "purchaseOrderId" TEXT,
ADD COLUMN "allocationBasis" TEXT;

-- CreateTable
CREATE TABLE "PurchaseCostAllocation" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "toStock" DECIMAL(65,30) NOT NULL,
    "toCogs" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PurchaseCostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseBill_purchaseOrderId_idx" ON "PurchaseBill"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseCostAllocation_billId_idx" ON "PurchaseCostAllocation"("billId");

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCostAllocation" ADD CONSTRAINT "PurchaseCostAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
