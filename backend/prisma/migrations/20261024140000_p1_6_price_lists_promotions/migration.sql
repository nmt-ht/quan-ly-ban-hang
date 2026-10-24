-- Pha 1.6 · Bảng giá riêng gán cho khách (giá theo mặt hàng/ĐVT) và khuyến mãi KM… (giảm theo hàng, theo đơn, bậc thang, tặng hàng).
-- Dòng đơn / báo giá ghi khuyến mãi đã áp (promotionId) và hàng tặng (isGift = chiết khấu 100%).
-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('GIAM_HANG', 'GIAM_DON', 'BAC_THANG', 'TANG_HANG');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PHAN_TRAM', 'SO_TIEN');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('TAT_CA', 'LOAI_KHACH', 'BANG_GIA');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "priceListId" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "promotionId" TEXT;

-- AlterTable
ALTER TABLE "QuotationLine" ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotionId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "promotionId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotionId" TEXT;

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "scope" "PromotionScope" NOT NULL DEFAULT 'TAT_CA',
    "customerTypes" "CustomerType"[],
    "priceListIds" TEXT[],
    "productIds" TEXT[],
    "categoryIds" TEXT[],
    "discountType" "DiscountType" NOT NULL DEFAULT 'PHAN_TRAM',
    "discountValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tiers" JSONB,
    "buyQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "giftProductId" TEXT,
    "giftQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_name_key" ON "PriceList"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productId_unitName_key" ON "PriceListItem"("priceListId", "productId", "unitName");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_giftProductId_fkey" FOREIGN KEY ("giftProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Quyền "Quản lý bảng giá", "Quản lý khuyến mãi": CEO (chức vụ hệ thống) và Quản lý. Ai lập đơn / báo giá cũng đọc được để áp giá.
INSERT INTO "Permission" ("code", "module", "label") VALUES
  ('pricelist.manage', 'price', 'Quản lý bảng giá'),
  ('promotion.manage', 'price', 'Quản lý khuyến mãi')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionCode")
  SELECT r."id", p.code FROM "Role" r CROSS JOIN (VALUES ('pricelist.manage'), ('promotion.manage')) AS p(code)
  WHERE r."isSystem" OR r."id" = 'role-manager'
ON CONFLICT DO NOTHING;
