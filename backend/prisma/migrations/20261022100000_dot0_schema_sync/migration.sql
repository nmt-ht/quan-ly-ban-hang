-- CreateEnum
CREATE TYPE "MeasureMode" AS ENUM ('AREA', 'LENGTH');

-- CreateEnum
CREATE TYPE "UnitOperation" AS ENUM ('MUL', 'DIV', 'ADD', 'SUB');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('XE_TAI', 'XE_VAN', 'XE_BA_GAC', 'XE_MAY', 'KHAC');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('DANG_DUNG', 'BAO_TRI', 'NGUNG_DUNG');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedReason" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "passwordUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "CompanyInfo" ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "measureMode" "MeasureMode",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UnitConversion" ADD COLUMN     "dropshipPrice" DECIMAL(65,30),
ADD COLUMN     "factor" DECIMAL(65,30),
ADD COLUMN     "operation" "UnitOperation" NOT NULL DEFAULT 'MUL',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wholesalePrice" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "WarehouseVoucher" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "deliveryTripId" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "productionOrderId" TEXT,
ADD COLUMN     "purchaseOrderId" TEXT,
ADD COLUMN     "salesOrderId" TEXT;

-- AlterTable
ALTER TABLE "WarehouseVoucherLine" ADD COLUMN     "bookQuantity" DECIMAL(65,30),
ADD COLUMN     "delta" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitName" TEXT,
ADD COLUMN     "unitQuantity" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "completeDate" DATE,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "producedQuantity" DECIMAL(65,30),
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creditDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep existing data: "được nợ" (yes/no) becomes 30 days.
UPDATE "Supplier" SET "creditDays" = 30 WHERE "creditAllowed";
ALTER TABLE "Supplier" DROP COLUMN "creditAllowed";

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "receivedDate" DATE,
ADD COLUMN     "sentDate" DATE,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "ratioToBase" DECIMAL(65,30) NOT NULL DEFAULT 1,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitName" TEXT,
ADD COLUMN     "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "closedDate" DATE,
ADD COLUMN     "deliveredDate" DATE,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "payNowAccountId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "orderDate" SET DATA TYPE DATE,
ALTER COLUMN "neededByDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "discountRate" DECIMAL(65,30),
ADD COLUMN     "ratioToBase" DECIMAL(65,30) NOT NULL DEFAULT 1,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitName" TEXT,
ADD COLUMN     "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "driverUserId" TEXT,
ADD COLUMN     "insuranceExpiry" DATE,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "registrationExpiry" DATE,
ADD COLUMN     "status" "VehicleStatus" NOT NULL DEFAULT 'DANG_DUNG',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type_new" "VehicleType" NOT NULL DEFAULT 'XE_TAI';

-- Keep existing data: free-text type ("Xe tải 1,5 tấn") maps onto the enum; inactive becomes Ngừng dùng.
UPDATE "Vehicle" SET "type_new" = (CASE
  WHEN "type" ILIKE '%van%' THEN 'XE_VAN'
  WHEN "type" ILIKE '%gác%' THEN 'XE_BA_GAC'
  WHEN "type" ILIKE '%máy%' THEN 'XE_MAY'
  WHEN "type" ILIKE '%tải%' THEN 'XE_TAI'
  ELSE 'KHAC' END)::"VehicleType";
UPDATE "Vehicle" SET "status" = 'NGUNG_DUNG' WHERE NOT "isActive";
ALTER TABLE "Vehicle" DROP COLUMN "type", DROP COLUMN "isActive";
ALTER TABLE "Vehicle" RENAME COLUMN "type_new" TO "type";

-- AlterTable
ALTER TABLE "DeliveryTrip" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "costNote" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "fuelCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "otherCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "plateNumber" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "tollCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "DeliveryTripOrder" ADD COLUMN     "confirmNote" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CashAccount" ADD COLUMN     "accountHolder" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CashVoucher" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierCode" TEXT,
    "purchasePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("supplierId","productId")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTripLoad" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "receivedQuantity" DECIMAL(65,30),

    CONSTRAINT "DeliveryTripLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCategory" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "VoucherKind" NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CashCategory_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CashAllocation" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "CashAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_finishedProductId_componentId_key" ON "BomLine"("finishedProductId", "componentId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_deliveryTripId_fkey" FOREIGN KEY ("deliveryTripId") REFERENCES "DeliveryTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_payNowAccountId_fkey" FOREIGN KEY ("payNowAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTrip" ADD CONSTRAINT "DeliveryTrip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTripLoad" ADD CONSTRAINT "DeliveryTripLoad_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DeliveryTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTripLoad" ADD CONSTRAINT "DeliveryTripLoad_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTripLoad" ADD CONSTRAINT "DeliveryTripLoad_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTripLoad" ADD CONSTRAINT "DeliveryTripLoad_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAllocation" ADD CONSTRAINT "CashAllocation_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "CashVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

