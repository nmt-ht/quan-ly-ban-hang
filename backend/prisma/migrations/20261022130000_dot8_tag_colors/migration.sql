-- Màu hiển thị move from each browser's storage to the company row.
-- AlterTable
ALTER TABLE "CompanyInfo" ADD COLUMN "tagColors" JSONB NOT NULL DEFAULT '{}';
