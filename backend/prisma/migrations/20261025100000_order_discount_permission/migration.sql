-- Quyền "Chiết khấu ngoài khuyến mãi": không có quyền này thì chiết khấu và hàng tặng trên đơn / báo giá không vượt mức
-- khuyến mãi đang chạy. CEO (chức vụ hệ thống) và Quản lý; Sale không.
INSERT INTO "Permission" ("code", "module", "label") VALUES ('order.discount', 'order', 'Chiết khấu ngoài khuyến mãi') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'order.discount' FROM "Role" r WHERE r."isSystem" OR r."id" = 'role-manager'
ON CONFLICT DO NOTHING;
