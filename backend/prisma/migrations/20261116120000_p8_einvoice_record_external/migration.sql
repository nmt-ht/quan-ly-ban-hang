-- Hoá đơn phát hành ngoài phần mềm (cổng của nhà cung cấp, ví dụ MISA) được ghi nhận số tại đây (provider = 'EXTERNAL').
-- Khi gỡ ghi nhận (nhập nhầm) hoá đơn chuyển sang VOID: như FAILED, nó không còn tính là "hoá đơn đang sống", nên đợt giao /
-- đơn / phiếu trả hàng đó được ghi nhận lại. Chỉ mục duy nhất từng phần phải loại cả VOID.
DROP INDEX IF EXISTS "EInvoice_live_delivery_key";
DROP INDEX IF EXISTS "EInvoice_live_order_key";
DROP INDEX IF EXISTS "EInvoice_live_return_key";

CREATE UNIQUE INDEX "EInvoice_live_delivery_key" ON "EInvoice"("deliveryId")
  WHERE "kind" = 'ORIGINAL' AND "deliveryId" IS NOT NULL AND "status" NOT IN ('FAILED', 'VOID');
CREATE UNIQUE INDEX "EInvoice_live_order_key" ON "EInvoice"("orderId")
  WHERE "kind" = 'ORIGINAL' AND "deliveryId" IS NULL AND "status" NOT IN ('FAILED', 'VOID');
CREATE UNIQUE INDEX "EInvoice_live_return_key" ON "EInvoice"("returnId")
  WHERE "kind" = 'ADJUST' AND "returnId" IS NOT NULL AND "status" NOT IN ('FAILED', 'VOID');

-- Một số hoá đơn (mẫu số + ký hiệu + số, bỏ số 0 đầu) chỉ thuộc về một hoá đơn đang sống: ghi nhận trùng bị từ chối ở tầng cơ sở dữ liệu.
CREATE UNIQUE INDEX "EInvoice_live_number_key" ON "EInvoice"("templateCode", "series", (ltrim("number", '0')))
  WHERE "number" IS NOT NULL AND "status" NOT IN ('FAILED', 'VOID');
