-- Giá bán tối thiểu (giá sàn) theo ĐVT chính; 0 = không giới hạn.
ALTER TABLE "Product" ADD COLUMN "minPrice" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Quyền "Bán dưới giá tối thiểu": không có quyền này thì đơn giá thực thu của dòng (sau chiết khấu, chưa thuế) trên đơn /
-- báo giá không được thấp hơn giá tối thiểu. CEO (chức vụ hệ thống) và Quản lý; Sale không.
INSERT INTO "Permission" ("code", "module", "label") VALUES ('order.below_min_price', 'order', 'Bán dưới giá tối thiểu') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'order.below_min_price' FROM "Role" r WHERE r."isSystem" OR r."id" = 'role-manager'
ON CONFLICT DO NOTHING;
