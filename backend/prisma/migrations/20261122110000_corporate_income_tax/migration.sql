-- Thuế TNDN: nguồn bút toán CIT, TK 3334, loại thu chi "Nộp thuế TNDN", bảng CitAssessment.

-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'CIT';

-- Danh mục cho cơ sở dữ liệu ĐÃ CÓ người dùng (khớp prisma/seed.ts); chạy lại an toàn.
INSERT INTO "Account" ("code", "name", "parentCode", "kind", "normalSide", "isDetail") VALUES
  ('3334', 'Thuế thu nhập doanh nghiệp', '333', 'NO_PHAI_TRA', 'CO', true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "CashCategory" ("code", "name", "kind", "partnerType", "isDefault", "isActive", "isSystem", "sortOrder", "defaultAccountCode")
SELECT 'CHI_THUE_TNDN', 'Nộp thuế TNDN', 'CHI'::"VoucherKind", 'KHAC'::"PartnerType", false, true, true, 20, '3334'
WHERE NOT EXISTS (SELECT 1 FROM "CashCategory" c WHERE c."kind" = 'CHI'::"VoucherKind" AND lower(c."name") = lower('Nộp thuế TNDN'))
ON CONFLICT ("code") DO NOTHING;

-- CreateTable
CREATE TABLE "CitAssessment" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "periodEnd" DATE NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "revenue" DECIMAL(65,30) NOT NULL,
    "accountingProfit" DECIMAL(65,30) NOT NULL,
    "addbacks" DECIMAL(65,30) NOT NULL,
    "deductions" DECIMAL(65,30) NOT NULL,
    "lossUsed" DECIMAL(65,30) NOT NULL,
    "taxableIncome" DECIMAL(65,30) NOT NULL,
    "taxCumulative" DECIMAL(65,30) NOT NULL,
    "taxPrior" DECIMAL(65,30) NOT NULL,
    "taxBooked" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,

    CONSTRAINT "CitAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CitAssessment_year_idx" ON "CitAssessment"("year");
