-- Kết chuyển lãi lỗ và đóng sổ năm.

-- CreateTable
CREATE TABLE "PeriodClosing" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "profit" DECIMAL(65,30) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,

    CONSTRAINT "PeriodClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYearClose" (
    "year" INTEGER NOT NULL,
    "profit" DECIMAL(65,30) NOT NULL,
    "previousLockDate" DATE,
    "closedById" TEXT NOT NULL,
    "closedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalYearClose_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE INDEX "PeriodClosing_year_idx" ON "PeriodClosing"("year");
