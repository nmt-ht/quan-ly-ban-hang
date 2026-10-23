-- Kho becomes a full record: mã kho, địa chỉ, điện thoại, thủ kho (a user), ghi chú, đang dùng / ngừng dùng.
-- AlterTable
ALTER TABLE "Warehouse"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "managerId" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing kho get codes KHO0000001… in name order; SequenceService raises the "KHO" sequence past them on boot.
UPDATE "Warehouse" w SET "code" = 'KHO' || LPAD(x.n::text, 7, '0')
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "name", "id") AS n FROM "Warehouse") x
WHERE w."id" = x."id";

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
