-- CreateEnum
CREATE TYPE "PrepaidStatus" AS ENUM ('DANG_PHAN_BO', 'HET_PHAN_BO');

-- CreateTable
CREATE TABLE "PrepaidItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(65,30) NOT NULL,
    "startDate" DATE NOT NULL,
    "allocationMonths" INTEGER NOT NULL,
    "expenseAccount" TEXT NOT NULL DEFAULT '642',
    "fundingAccount" TEXT NOT NULL DEFAULT '153',
    "allocated" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "PrepaidStatus" NOT NULL DEFAULT 'DANG_PHAN_BO',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepaidAllocation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PrepaidAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrepaidItem_code_key" ON "PrepaidItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PrepaidAllocation_itemId_period_key" ON "PrepaidAllocation"("itemId", "period");

-- AddForeignKey
ALTER TABLE "PrepaidItem" ADD CONSTRAINT "PrepaidItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidAllocation" ADD CONSTRAINT "PrepaidAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PrepaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
