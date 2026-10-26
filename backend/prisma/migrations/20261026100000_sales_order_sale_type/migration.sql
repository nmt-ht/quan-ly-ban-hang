-- Loại chứng từ bán hàng (as MISA): trong nước / xuất khẩu. Đơn cũ là bán trong nước.
CREATE TYPE "SaleType" AS ENUM ('TRONG_NUOC', 'XUAT_KHAU');

ALTER TABLE "SalesOrder" ADD COLUMN "saleType" "SaleType" NOT NULL DEFAULT 'TRONG_NUOC',
ADD COLUMN "currency" TEXT,
ADD COLUMN "exchangeRate" DECIMAL(65,30);
