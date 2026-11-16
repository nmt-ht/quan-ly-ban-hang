-- Kiểm kê quỹ: lập phiếu xử lý chênh lệch thừa / thiếu quỹ.
-- 1. Biên bản kiểm kê ghi cách xử lý và phiếu thu / chi đã lập.
ALTER TABLE "CashCount" ADD COLUMN "resolution" TEXT;
ALTER TABLE "CashCount" ADD COLUMN "resolutionVoucherId" TEXT;
CREATE UNIQUE INDEX "CashCount_resolutionVoucherId_key" ON "CashCount"("resolutionVoucherId");
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_resolutionVoucherId_fkey" FOREIGN KEY ("resolutionVoucherId") REFERENCES "CashVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Tài khoản 138 / 1381 (tài sản thiếu chờ xử lý) và 3381 (tài sản thừa chờ giải quyết). Khớp prisma/seed.ts; chạy lại an toàn.
INSERT INTO "Account" ("code", "name", "parentCode", "kind", "normalSide", "isDetail") VALUES
  ('138', 'Phải thu khác', NULL, 'TAI_SAN', 'NO', false),
  ('1381', 'Tài sản thiếu chờ xử lý', '138', 'TAI_SAN', 'NO', true),
  ('3381', 'Tài sản thừa chờ giải quyết', '338', 'NO_PHAI_TRA', 'CO', true)
ON CONFLICT ("code") DO NOTHING;

-- 3. Bốn loại thu chi hệ thống cho phiếu xử lý chênh lệch kiểm kê quỹ.
INSERT INTO "CashCategory" ("code", "name", "kind", "partnerType", "isDefault", "isActive", "isSystem", "sortOrder", "defaultAccountCode")
SELECT v."code", v."name", v."kind"::"VoucherKind", 'KHAC'::"PartnerType", false, true, true, v."sortOrder", v."account"
FROM (VALUES
  ('CHI_THIEU_QUY_CHO_XL', 'Thiếu quỹ chờ xử lý', 'CHI', 8, '1381'),
  ('CHI_THIEU_QUY', 'Thiếu quỹ tính vào chi phí khác', 'CHI', 9, '811'),
  ('THU_THUA_QUY_CHO_XL', 'Thừa quỹ chờ giải quyết', 'THU', 10, '3381'),
  ('THU_THUA_QUY', 'Thừa quỹ tính vào thu nhập khác', 'THU', 11, '711')
) AS v("code", "name", "kind", "sortOrder", "account")
WHERE NOT EXISTS (SELECT 1 FROM "CashCategory" c WHERE c."kind" = v."kind"::"VoucherKind" AND lower(c."name") = lower(v."name"))
ON CONFLICT ("code") DO NOTHING;
