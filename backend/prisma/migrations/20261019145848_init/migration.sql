-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('VAT_TU', 'THANH_PHAM', 'DICH_VU');

-- CreateEnum
CREATE TYPE "WarehouseVoucherType" AS ENUM ('NHAP', 'XUAT', 'CHUYEN', 'KIEM_KE');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('NHAP', 'DANG_SAN_XUAT', 'HOAN_TAT', 'HUY');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('NHAP', 'DA_GUI_NCC', 'NHAN_MOT_PHAN', 'DA_NHAN_DU', 'HOAN_TAT', 'HUY');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('LE', 'SI', 'DROPSHIP');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('CHO_SAN_XUAT', 'DANG_SAN_XUAT', 'CHO_GIAO_HANG', 'DANG_GIAO', 'HOAN_THANH', 'GIAO_MOT_PHAN', 'TRA_TOAN_BO', 'HUY');

-- CreateEnum
CREATE TYPE "DeliveryTripStatus" AS ENUM ('GOM_DON', 'DA_XUAT_KHO', 'XE_VE_KHO', 'HOAN_TAT', 'HUY');

-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('TIEN_MAT', 'NGAN_HANG');

-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('THU', 'CHI');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('KHACH_HANG', 'NHA_CUNG_CAP', 'KHAC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionCode")
);

-- CreateTable
CREATE TABLE "CompanyInfo" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "taxCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,

    CONSTRAINT "CompanyInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "crossRefCode" TEXT,
    "categoryId" TEXT,
    "defaultWarehouseId" TEXT,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT,
    "retailPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "wholesalePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dropshipPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "purchaseNote" TEXT,
    "saleNote" TEXT,
    "description" TEXT,
    "isSellable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "ratioToBaseUnit" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("productId","warehouseId")
);

-- CreateTable
CREATE TABLE "WarehouseVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WarehouseVoucherType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "targetWarehouseId" TEXT,
    "reason" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseVoucherLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "WarehouseVoucherLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sourceOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'NHAP',
    "bomSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPhone" TEXT,
    "taxCode" TEXT,
    "address" TEXT,
    "creditAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'NHAP',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "receivedQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "type" "CustomerType" NOT NULL DEFAULT 'LE',
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT,
    "idNumber" TEXT,
    "personalTaxCode" TEXT,
    "companyTaxCode" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTag" (
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("customerId","tagId")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "description" TEXT,
    "source" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "neededByDate" TIMESTAMP(3),
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'CHO_SAN_XUAT',
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "salesRepId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderTag" (
    "orderId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "SalesOrderTag_pkey" PRIMARY KEY ("orderId","tagId")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "length" DECIMAL(65,30),
    "width" DECIMAL(65,30),
    "note" TEXT,
    "receivedQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "loadCapacity" DECIMAL(65,30),
    "usualDriver" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTrip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "driverName" TEXT,
    "vehicleId" TEXT,
    "status" "DeliveryTripStatus" NOT NULL DEFAULT 'GOM_DON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTripOrder" (
    "tripId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "DeliveryTripOrder_pkey" PRIMARY KEY ("tripId","orderId")
);

-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "VoucherKind" NOT NULL,
    "category" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "settledAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseVoucher_code_key" ON "WarehouseVoucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_code_key" ON "ProductionOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_code_key" ON "SalesOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTrip_code_key" ON "DeliveryTrip"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CashVoucher_code_key" ON "CashVoucher"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "Permission"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_targetWarehouseId_fkey" FOREIGN KEY ("targetWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucher" ADD CONSTRAINT "WarehouseVoucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucherLine" ADD CONSTRAINT "WarehouseVoucherLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "WarehouseVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseVoucherLine" ADD CONSTRAINT "WarehouseVoucherLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTag" ADD CONSTRAINT "CustomerTag_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTag" ADD CONSTRAINT "CustomerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderTag" ADD CONSTRAINT "SalesOrderTag_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderTag" ADD CONSTRAINT "SalesOrderTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTrip" ADD CONSTRAINT "DeliveryTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTripOrder" ADD CONSTRAINT "DeliveryTripOrder_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DeliveryTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTripOrder" ADD CONSTRAINT "DeliveryTripOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashVoucher" ADD CONSTRAINT "CashVoucher_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashVoucher" ADD CONSTRAINT "CashVoucher_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashVoucher" ADD CONSTRAINT "CashVoucher_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashVoucher" ADD CONSTRAINT "CashVoucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
