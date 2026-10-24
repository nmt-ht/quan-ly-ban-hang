-- Hạn mức công nợ theo khách hàng (0 = không giới hạn).
ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0;
