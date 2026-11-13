-- CreateEnum
CREATE TYPE "ProductionCostKind" AS ENUM ('NHAN_CONG', 'SAN_XUAT_CHUNG');

-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'PRODUCTION';

-- CreateTable
CREATE TABLE "ProductionCost" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "ProductionCostKind" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "creditAccount" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionCost_orderId_idx" ON "ProductionCost"("orderId");

-- AddForeignKey
ALTER TABLE "ProductionCost" ADD CONSTRAINT "ProductionCost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCost" ADD CONSTRAINT "ProductionCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
