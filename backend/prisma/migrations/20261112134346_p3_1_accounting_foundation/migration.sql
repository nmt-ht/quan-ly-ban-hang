-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('TAI_SAN', 'NO_PHAI_TRA', 'VON_CSH', 'DOANH_THU', 'CHI_PHI', 'KQKD');

-- CreateEnum
CREATE TYPE "NormalSide" AS ENUM ('NO', 'CO');

-- CreateEnum
CREATE TYPE "JournalSource" AS ENUM ('SALES_DELIVERY', 'CASH_VOUCHER', 'PURCHASE_RECEIPT', 'SALES_RETURN', 'PURCHASE_RETURN', 'CLOSING', 'MANUAL', 'REVERSAL');

-- AlterTable
ALTER TABLE "CashCategory" ADD COLUMN     "defaultAccountCode" TEXT;

-- AlterTable
ALTER TABLE "CompanyInfo" ADD COLUMN     "ledgerStartDate" DATE;

-- CreateTable
CREATE TABLE "Account" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCode" TEXT,
    "kind" "AccountKind" NOT NULL,
    "normalSide" "NormalSide" NOT NULL,
    "isDetail" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "source" "JournalSource" NOT NULL DEFAULT 'MANUAL',
    "refType" TEXT,
    "refId" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "partnerType" "PartnerType",
    "customerId" TEXT,
    "supplierId" TEXT,
    "description" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningBalance" (
    "accountCode" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("accountCode","period")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_code_key" ON "JournalEntry"("code");

-- CreateIndex
CREATE INDEX "JournalEntry_refType_refId_idx" ON "JournalEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountCode_idx" ON "JournalLine"("accountCode");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "Account"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
