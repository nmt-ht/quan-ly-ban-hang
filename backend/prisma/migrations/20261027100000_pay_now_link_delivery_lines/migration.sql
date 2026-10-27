-- "Thu tiền ngay": the phiếu thu made by itself for a đơn bán points at it and at the đợt giao it collects, instead of
-- being found by its diễn giải.
ALTER TABLE "CashVoucher" ADD COLUMN "salesOrderId" TEXT, ADD COLUMN "salesOrderDeliveryId" TEXT;
ALTER TABLE "CashVoucher" ADD CONSTRAINT "CashVoucher_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashVoucher" ADD CONSTRAINT "CashVoucher_salesOrderDeliveryId_fkey"
  FOREIGN KEY ("salesOrderDeliveryId") REFERENCES "SalesOrderDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CashVoucher_salesOrderId_idx" ON "CashVoucher"("salesOrderId");
CREATE INDEX "CashVoucher_salesOrderDeliveryId_idx" ON "CashVoucher"("salesOrderDeliveryId");

-- Phiếu thu tự lập so far carried "Thu tiền ngay đơn DH…" as diễn giải.
UPDATE "CashVoucher" v SET "salesOrderId" = o."id"
FROM "SalesOrder" o
WHERE v."kind" = 'THU' AND v."description" = 'Thu tiền ngay đơn ' || o."code";

-- Số khách nhận từng dòng trong mỗi đợt giao: the chứng từ bán hàng a hoá đơn GTGT is made from.
CREATE TABLE "SalesOrderDeliveryLine" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    CONSTRAINT "SalesOrderDeliveryLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesOrderDeliveryLine_deliveryId_idx" ON "SalesOrderDeliveryLine"("deliveryId");
ALTER TABLE "SalesOrderDeliveryLine" ADD CONSTRAINT "SalesOrderDeliveryLine_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "SalesOrderDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderDeliveryLine" ADD CONSTRAINT "SalesOrderDeliveryLine_orderLineId_fkey"
  FOREIGN KEY ("orderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Đợt đã ghi trước đây: an đợt chốt trên chuyến takes what each dòng received off that chuyến.
INSERT INTO "SalesOrderDeliveryLine" ("id", "deliveryId", "orderLineId", "quantity")
SELECT gen_random_uuid()::text, d."id", l."orderLineId", l."receivedQuantity"
FROM "SalesOrderDelivery" d
JOIN "DeliveryTripLoad" l ON l."tripId" = d."tripId"
JOIN "SalesOrderLine" ol ON ol."id" = l."orderLineId" AND ol."orderId" = d."orderId"
WHERE l."receivedQuantity" > 0;

-- A đơn with a single giao tay: that đợt took whatever the dòng received outside chuyến. Several giao tay cannot be told
-- apart any more — they stay without lines and the hoá đơn of those đợt is made by hand.
INSERT INTO "SalesOrderDeliveryLine" ("id", "deliveryId", "orderLineId", "quantity")
SELECT gen_random_uuid()::text, d."id", ol."id", ol."receivedQuantity" - COALESCE(t."quantity", 0)
FROM "SalesOrderDelivery" d
JOIN "SalesOrderLine" ol ON ol."orderId" = d."orderId"
LEFT JOIN (
  SELECT l."orderLineId", SUM(l."receivedQuantity") AS "quantity"
  FROM "DeliveryTripLoad" l WHERE l."receivedQuantity" > 0 GROUP BY l."orderLineId"
) t ON t."orderLineId" = ol."id"
WHERE d."tripId" IS NULL
  AND (SELECT COUNT(*) FROM "SalesOrderDelivery" x WHERE x."orderId" = d."orderId" AND x."tripId" IS NULL) = 1
  AND ol."receivedQuantity" - COALESCE(t."quantity", 0) > 0;
