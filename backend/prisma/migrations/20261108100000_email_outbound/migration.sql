-- Email gửi đi (as MISA): cấu hình hộp thư, mẫu email theo loại chứng từ, nhật ký gửi.
CREATE TABLE "MailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'OFF',
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "bcc" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "passwordSealed" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MailSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailTemplate" (
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MailTemplate_pkey" PRIMARY KEY ("kind")
);

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "docId" TEXT,
    "docCode" TEXT,
    "to" TEXT[],
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "attachment" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "messageId" TEXT,
    "sentById" TEXT,
    "sentByName" TEXT NOT NULL,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailLog_kind_docId_at_idx" ON "EmailLog"("kind", "docId", "at");
CREATE INDEX "EmailLog_at_idx" ON "EmailLog"("at");

-- Quyền "Gửi email chứng từ": CEO, Quản lý, and every role that already lập báo giá / đơn / phiếu thu or nhắc nợ.
INSERT INTO "Permission" ("code", "module", "label") VALUES ('email.send', 'company', 'Gửi email chứng từ cho khách hàng / NCC') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT DISTINCT r."id", 'email.send' FROM "Role" r
  LEFT JOIN "RolePermission" rp ON rp."roleId" = r."id"
  WHERE r."isSystem" OR r."id" = 'role-manager'
     OR rp."permissionCode" IN ('quote.create', 'order.create', 'purchase.create', 'voucher.create_receipt', 'debt.remind')
ON CONFLICT DO NOTHING;
