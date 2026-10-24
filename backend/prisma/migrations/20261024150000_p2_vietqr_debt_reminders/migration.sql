-- Pha 2 · VietQR (mã BIN ngân hàng trên tài khoản tiền) và nhắc nợ khách hàng (lịch sử từng lần nhắc, hẹn trả).
-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('ZALO', 'SMS', 'GOI_DIEN', 'EMAIL', 'GAP_TRUC_TIEP', 'KHAC');

-- AlterTable
ALTER TABLE "CashAccount" ADD COLUMN     "bankBin" TEXT;

-- CreateTable
CREATE TABLE "DebtReminder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "note" TEXT,
    "balance" DECIMAL(65,30) NOT NULL,
    "overdue" DECIMAL(65,30) NOT NULL,
    "promisedDate" DATE,
    "promisedAmount" DECIMAL(65,30),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtReminder_customerId_createdAt_idx" ON "DebtReminder"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Quyền "Nhắc nợ khách hàng": CEO (chức vụ hệ thống), Quản lý, Kế toán.
INSERT INTO "Permission" ("code", "module", "label") VALUES ('debt.remind', 'debt', 'Nhắc nợ khách hàng') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", 'debt.remind' FROM "Role" r WHERE r."isSystem" OR r."id" IN ('role-manager', 'role-accountant')
ON CONFLICT DO NOTHING;
