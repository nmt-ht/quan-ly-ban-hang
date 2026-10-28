-- Đơn bán bằng ngoại tệ (as MISA): đơn giá nguyên tệ của dòng; đơn giá VND = nguyên tệ × tỷ giá của đơn.
ALTER TABLE "SalesOrderLine" ADD COLUMN "unitPriceFx" DECIMAL(65,30);
