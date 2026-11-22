-- Hợp đồng bán (HDB…) / mua (HDM…): thoả thuận khung với khách hàng hoặc nhà cung cấp; đơn bán / đơn mua gắn vào để theo dõi giá trị đã thực hiện.

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('BAN', 'MUA');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DANG_THUC_HIEN', 'DA_THANH_LY', 'HUY');

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "contractId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "contractId" TEXT;

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ContractKind" NOT NULL,
    "contractNo" TEXT,
    "title" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "signedDate" DATE NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "description" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DANG_THUC_HIEN',
    "closedDate" DATE,
    "closeNote" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");

-- CreateIndex
CREATE INDEX "Contract_kind_status_idx" ON "Contract"("kind", "status");

-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");

-- CreateIndex
CREATE INDEX "Contract_supplierId_idx" ON "Contract"("supplierId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Một hợp đồng có đúng một đối tác, và đúng loại: bán → khách hàng, mua → nhà cung cấp.
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_party_check" CHECK (
  ("kind" = 'BAN' AND "customerId" IS NOT NULL AND "supplierId" IS NULL)
  OR ("kind" = 'MUA' AND "supplierId" IS NOT NULL AND "customerId" IS NULL)
);
