-- CreateEnum
CREATE TYPE "PayrollCenter" AS ENUM ('QUAN_LY', 'BAN_HANG', 'SAN_XUAT');

-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'PAYROLL';

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "center" "PayrollCenter" NOT NULL DEFAULT 'QUAN_LY',
    "baseSalary" DECIMAL(65,30) NOT NULL,
    "allowance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "insuranceSalary" DECIMAL(65,30),
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bhxhEmployee" DECIMAL(65,30) NOT NULL DEFAULT 8,
    "bhytEmployee" DECIMAL(65,30) NOT NULL DEFAULT 1.5,
    "bhtnEmployee" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "bhxhEmployer" DECIMAL(65,30) NOT NULL DEFAULT 17.5,
    "bhytEmployer" DECIMAL(65,30) NOT NULL DEFAULT 3,
    "bhtnEmployer" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "kpcd" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "socialCap" DECIMAL(65,30) NOT NULL DEFAULT 50600000,
    "unemploymentCap" DECIMAL(65,30) NOT NULL DEFAULT 106200000,
    "personalDeduction" DECIMAL(65,30) NOT NULL DEFAULT 15500000,
    "dependentDeduction" DECIMAL(65,30) NOT NULL DEFAULT 6200000,
    "brackets" JSONB NOT NULL,

    CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "center" "PayrollCenter" NOT NULL,
    "gross" DECIMAL(65,30) NOT NULL,
    "adjustment" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bhxhEe" DECIMAL(65,30) NOT NULL,
    "bhytEe" DECIMAL(65,30) NOT NULL,
    "bhtnEe" DECIMAL(65,30) NOT NULL,
    "taxable" DECIMAL(65,30) NOT NULL,
    "pit" DECIMAL(65,30) NOT NULL,
    "net" DECIMAL(65,30) NOT NULL,
    "bhxhEr" DECIMAL(65,30) NOT NULL,
    "bhytEr" DECIMAL(65,30) NOT NULL,
    "bhtnEr" DECIMAL(65,30) NOT NULL,
    "kpcd" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_period_key" ON "PayrollRun"("period");

-- CreateIndex
CREATE INDEX "PayrollLine_runId_idx" ON "PayrollLine"("runId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
