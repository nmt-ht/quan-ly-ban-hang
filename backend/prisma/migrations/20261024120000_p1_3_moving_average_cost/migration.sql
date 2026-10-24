-- Pha 1.3: giá vốn bình quân gia quyền di động. Product.avgCost is kept by InventoryService.post / reverse;
-- every phiếu kho line from now on stores the cost it moved at (unitCost). Older lines stay NULL (reports fall back).
ALTER TABLE "Product" ADD COLUMN "avgCost" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "WarehouseVoucherLine" ADD COLUMN "unitCost" DECIMAL(65,30);

-- Opening average = the estimate used until now: vật tư (and hàng hoá) = giá nhập gần nhất per ĐVT chính
-- (đơn nhập chưa huỷ), thành phẩm = định mức × that price, dịch vụ = 0.
WITH last AS (
  SELECT DISTINCT ON (l."productId") l."productId", l."unitPrice" / NULLIF(l."ratioToBase", 0) AS price
  FROM "PurchaseOrderLine" l JOIN "PurchaseOrder" o ON o."id" = l."orderId"
  WHERE o."status" <> 'HUY'
  ORDER BY l."productId", o."date" DESC, o."createdAt" DESC
)
UPDATE "Product" p SET "avgCost" = ROUND(last.price, 4)
FROM last WHERE p."id" = last."productId" AND p."type" NOT IN ('DICH_VU', 'THANH_PHAM') AND last.price IS NOT NULL;

UPDATE "Product" p SET "avgCost" = ROUND(b.cost, 4)
FROM (
  SELECT bl."finishedProductId" AS id, SUM(bl."quantityPerUnit" * c."avgCost") AS cost
  FROM "BomLine" bl JOIN "Product" c ON c."id" = bl."componentId"
  GROUP BY bl."finishedProductId"
) b
WHERE p."id" = b.id AND p."type" = 'THANH_PHAM';
