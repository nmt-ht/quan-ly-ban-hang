-- Thiết lập "Cho xuất quá số tồn" (as MISA): bật như trước; tắt thì phiếu xuất làm tồn kho âm bị từ chối.
ALTER TABLE "CompanyInfo" ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true;

-- Quyền "Xuất vượt tồn kho": vẫn xuất được khi đã tắt thiết lập trên. CEO (chức vụ hệ thống) và Quản lý.
INSERT INTO "Permission" ("code", "module", "label") VALUES ('stock.overdraw', 'stock', 'Xuất vượt tồn kho') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'stock.overdraw' FROM "Role" r WHERE r."isSystem" OR r."id" = 'role-manager'
ON CONFLICT DO NOTHING;
