-- Dữ liệu danh mục của phân hệ kế toán cho cơ sở dữ liệu ĐÃ CÓ người dùng (bootstrap.ts chỉ chạy seed khi database còn trống):
-- quyền accounting.*, cấp quyền cho CEO / Quản lý / Kế toán, hệ thống tài khoản TT133, loại thu chi hệ thống.
-- Chạy lại nhiều lần vẫn an toàn (ON CONFLICT); không ghi đè chỉnh sửa tay của người dùng. Khớp prisma/seed.ts.

-- 1. Quyền
INSERT INTO "Permission" ("code", "module", "label") VALUES
  ('accounting.view', 'accounting', 'Xem sổ sách kế toán (nhật ký, sổ cái, cân đối)'),
  ('accounting.manual', 'accounting', 'Nhập bút toán thủ công'),
  ('accounting.reverse', 'accounting', 'Đảo / huỷ bút toán'),
  ('accounting.opening', 'accounting', 'Nhập số dư đầu kỳ'),
  ('accounting.manage_account', 'accounting', 'Quản lý hệ thống tài khoản'),
  ('accounting.payroll', 'accounting', 'Quản lý nhân viên, tính và chốt bảng lương')
ON CONFLICT DO NOTHING;

-- 2. Cấp quyền cho các chức vụ mặc định đang có (chỉ thêm, không gỡ)
INSERT INTO "RolePermission" ("roleId", "permissionCode")
SELECT r."id", p."code"
FROM "Role" r
CROSS JOIN (VALUES
  ('accounting.view'), ('accounting.manual'), ('accounting.reverse'), ('accounting.opening'), ('accounting.manage_account'), ('accounting.payroll')
) AS p("code")
WHERE r."id" IN ('role-ceo', 'role-manager', 'role-accountant')
ON CONFLICT DO NOTHING;

-- 3. Hệ thống tài khoản TT133 (bộ rút gọn cho nghiệp vụ hiện có)
INSERT INTO "Account" ("code", "name", "parentCode", "kind", "normalSide", "isDetail") VALUES
  ('111', 'Tiền mặt', NULL, 'TAI_SAN', 'NO', true),
  ('112', 'Tiền gửi ngân hàng', NULL, 'TAI_SAN', 'NO', true),
  ('113', 'Tiền đang chuyển', NULL, 'TAI_SAN', 'NO', true),
  ('131', 'Phải thu của khách hàng', NULL, 'TAI_SAN', 'NO', true),
  ('133', 'Thuế GTGT được khấu trừ', NULL, 'TAI_SAN', 'NO', true),
  ('141', 'Tạm ứng', NULL, 'TAI_SAN', 'NO', true),
  ('152', 'Nguyên liệu, vật liệu', NULL, 'TAI_SAN', 'NO', true),
  ('153', 'Công cụ, dụng cụ', NULL, 'TAI_SAN', 'NO', true),
  ('154', 'Chi phí sản xuất, kinh doanh dở dang', NULL, 'TAI_SAN', 'NO', true),
  ('155', 'Thành phẩm', NULL, 'TAI_SAN', 'NO', true),
  ('156', 'Hàng hóa', NULL, 'TAI_SAN', 'NO', true),
  ('211', 'Tài sản cố định', NULL, 'TAI_SAN', 'NO', true),
  ('214', 'Hao mòn tài sản cố định', NULL, 'TAI_SAN', 'CO', true),
  ('242', 'Chi phí trả trước', NULL, 'TAI_SAN', 'NO', true),
  ('331', 'Phải trả cho người bán', NULL, 'NO_PHAI_TRA', 'CO', true),
  ('333', 'Thuế và các khoản phải nộp Nhà nước', NULL, 'NO_PHAI_TRA', 'CO', false),
  ('3331', 'Thuế GTGT phải nộp', '333', 'NO_PHAI_TRA', 'CO', true),
  ('3335', 'Thuế thu nhập cá nhân', '333', 'NO_PHAI_TRA', 'CO', true),
  ('338', 'Phải trả, phải nộp khác', NULL, 'NO_PHAI_TRA', 'CO', false),
  ('3382', 'Kinh phí công đoàn', '338', 'NO_PHAI_TRA', 'CO', true),
  ('3383', 'Bảo hiểm xã hội', '338', 'NO_PHAI_TRA', 'CO', true),
  ('3384', 'Bảo hiểm y tế', '338', 'NO_PHAI_TRA', 'CO', true),
  ('3385', 'Bảo hiểm thất nghiệp', '338', 'NO_PHAI_TRA', 'CO', true),
  ('334', 'Phải trả người lao động', NULL, 'NO_PHAI_TRA', 'CO', true),
  ('411', 'Vốn đầu tư của chủ sở hữu', NULL, 'VON_CSH', 'CO', true),
  ('421', 'Lợi nhuận sau thuế chưa phân phối', NULL, 'VON_CSH', 'CO', true),
  ('511', 'Doanh thu bán hàng và cung cấp dịch vụ', NULL, 'DOANH_THU', 'CO', true),
  ('515', 'Doanh thu hoạt động tài chính', NULL, 'DOANH_THU', 'CO', true),
  ('632', 'Giá vốn hàng bán', NULL, 'CHI_PHI', 'NO', true),
  ('635', 'Chi phí tài chính', NULL, 'CHI_PHI', 'NO', true),
  ('641', 'Chi phí bán hàng', NULL, 'CHI_PHI', 'NO', true),
  ('642', 'Chi phí quản lý kinh doanh', NULL, 'CHI_PHI', 'NO', true),
  ('711', 'Thu nhập khác', NULL, 'DOANH_THU', 'CO', true),
  ('811', 'Chi phí khác', NULL, 'CHI_PHI', 'NO', true),
  ('821', 'Chi phí thuế thu nhập doanh nghiệp', NULL, 'CHI_PHI', 'NO', true),
  ('911', 'Xác định kết quả kinh doanh', NULL, 'KQKD', 'NO', true)
ON CONFLICT ("code") DO NOTHING;

-- 4. Loại thu chi: TK đối ứng mặc định cho loại có sẵn (chỉ khi chưa khai) và các loại hệ thống mới
UPDATE "CashCategory" SET "defaultAccountCode" = '131' WHERE "code" = 'THU_KH' AND "defaultAccountCode" IS NULL;
UPDATE "CashCategory" SET "defaultAccountCode" = '711' WHERE "code" = 'THU_KHAC' AND "defaultAccountCode" IS NULL;
UPDATE "CashCategory" SET "defaultAccountCode" = '331' WHERE "code" = 'CHI_NCC' AND "defaultAccountCode" IS NULL;
UPDATE "CashCategory" SET "defaultAccountCode" = '642' WHERE "code" = 'CHI_KHAC' AND "defaultAccountCode" IS NULL;

INSERT INTO "CashCategory" ("code", "name", "kind", "partnerType", "isDefault", "isActive", "isSystem", "sortOrder", "defaultAccountCode")
SELECT v."code", v."name", v."kind"::"VoucherKind", 'KHAC'::"PartnerType", false, true, true, v."sortOrder", v."account"
FROM (VALUES
  ('CHI_LUONG', 'Chi lương nhân viên', 'CHI', 4, '334'),
  ('CHI_THUE', 'Nộp thuế GTGT', 'CHI', 5, '3331'),
  ('CHI_NOIBO', 'Chuyển tiền nội bộ', 'CHI', 6, '113'),
  ('THU_NOIBO', 'Nhận tiền chuyển nội bộ', 'THU', 7, '113')
) AS v("code", "name", "kind", "sortOrder", "account")
WHERE NOT EXISTS (SELECT 1 FROM "CashCategory" c WHERE c."kind" = v."kind"::"VoucherKind" AND lower(c."name") = lower(v."name"))
ON CONFLICT ("code") DO NOTHING;
