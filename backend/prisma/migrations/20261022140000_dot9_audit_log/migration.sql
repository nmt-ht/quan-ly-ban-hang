-- Nhật ký hoạt động (append-only).
-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityCode" TEXT,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "related" TEXT[],
    "ip" TEXT,
    "requestId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_id_idx" ON "AuditLog"("entityType", "entityId", "id");
CREATE INDEX "AuditLog_userId_id_idx" ON "AuditLog"("userId", "id");
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");
CREATE INDEX "AuditLog_related_idx" ON "AuditLog" USING GIN ("related");

-- Quyền xem nhật ký: CEO (chức vụ hệ thống) và Quản lý. prisma/seed.ts keeps it on re-seed.
INSERT INTO "Permission" ("code", "module", "label") VALUES ('audit.view', 'audit', 'Xem nhật ký hoạt động') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'audit.view' FROM "Role" r WHERE r."isSystem" OR r."id" = 'role-manager'
  ON CONFLICT DO NOTHING;

-- Documents that existed before the log get their known moments as the first lines of their history:
-- when and by whom they were made, and (phiếu kho, phiếu thu chi) when they were cancelled.
INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."createdAt", d."createdById", COALESCE(u."name", 'Hệ thống'), 'sales_order.create', 'SalesOrder', d."id", d."code",
       'Lập đơn hàng bán ' || d."code" || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "SalesOrder" d LEFT JOIN "User" u ON u."id" = d."createdById";

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."createdAt", d."createdById", COALESCE(u."name", 'Hệ thống'), 'purchase_order.create', 'PurchaseOrder', d."id", d."code",
       'Lập đơn nhập hàng ' || d."code" || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "PurchaseOrder" d LEFT JOIN "User" u ON u."id" = d."createdById";

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."createdAt", d."createdById", COALESCE(u."name", 'Hệ thống'), 'production_order.create', 'ProductionOrder', d."id", d."code",
       'Lập lệnh sản xuất ' || d."code" || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "ProductionOrder" d LEFT JOIN "User" u ON u."id" = d."createdById";

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."createdAt", d."createdById", COALESCE(u."name", 'Hệ thống'), 'delivery_trip.create', 'DeliveryTrip', d."id", d."code",
       'Tạo chuyến giao hàng ' || d."code" || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "DeliveryTrip" d LEFT JOIN "User" u ON u."id" = d."createdById";

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."createdAt", d."createdById", COALESCE(u."name", 'Hệ thống'), 'warehouse_voucher.create', 'WarehouseVoucher', d."id", d."code",
       'Lập phiếu kho ' || d."code" || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "WarehouseVoucher" d LEFT JOIN "User" u ON u."id" = d."createdById";

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."cancelledAt", NULL, 'Hệ thống', 'warehouse_voucher.cancel', 'WarehouseVoucher', d."id", d."code",
       'Huỷ phiếu kho ' || d."code" || COALESCE(': ' || d."cancelReason", '') || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "WarehouseVoucher" d WHERE d."isCancelled" AND d."cancelledAt" IS NOT NULL;

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."createdAt", d."createdById", COALESCE(u."name", 'Hệ thống'), 'cash_voucher.create', 'CashVoucher', d."id", d."code",
       'Lập ' || CASE WHEN d."kind" = 'THU' THEN 'phiếu thu ' ELSE 'phiếu chi ' END || d."code" || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "CashVoucher" d LEFT JOIN "User" u ON u."id" = d."createdById";

INSERT INTO "AuditLog" ("at", "userId", "userName", "action", "entityType", "entityId", "entityCode", "summary")
SELECT d."cancelledAt", NULL, 'Hệ thống', 'cash_voucher.cancel', 'CashVoucher', d."id", d."code",
       'Huỷ ' || CASE WHEN d."kind" = 'THU' THEN 'phiếu thu ' ELSE 'phiếu chi ' END || d."code" || COALESCE(': ' || d."cancelReason", '') || ' (ghi lại từ dữ liệu có trước nhật ký)'
FROM "CashVoucher" d WHERE d."isCancelled" AND d."cancelledAt" IS NOT NULL;

-- Append-only: nothing may change or remove a line once written.
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Nhật ký hoạt động chỉ được thêm, không được sửa hoặc xoá';
END;
$$;

CREATE TRIGGER "AuditLog_no_update_delete" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();
CREATE TRIGGER "AuditLog_no_truncate" BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_append_only"();
