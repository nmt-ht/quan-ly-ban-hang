# Dữ liệu demo (GIẢ)

Toàn bộ dữ liệu trong thư mục này là **giả**, sinh tự động để thử giao diện và luồng trạng thái. Production `ninhtrang-frontend-production.up.railway.app` **không bị ghi gì** (không có staging, nên không đẩy dữ liệu thử lên đó).

## Cách dùng

| Việc | Lệnh |
| --- | --- |
| Sinh lại dữ liệu (deterministic, seed cố định) | `node tools/gen-demo-data.mjs` (hoặc `npm run demo:gen` trong `backend/`) |
| Nạp vào database | `cd backend && npx prisma generate && npx prisma migrate dev` rồi `npm run prisma:seed` rồi `DEMO_USER_PASSWORD='...' npm run prisma:seed:demo` |
| Frontend | Tự dùng `frontend/src/app/core/data/demo-data.ts` qua `MockDataService` |

`seed-demo.ts` idempotent (bỏ qua nếu đã có khách `KH0000001`) và từ chối chạy khi `NODE_ENV=production`. Mật khẩu user demo lấy từ biến môi trường `DEMO_USER_PASSWORD`, không ghi vào repo.

Không sửa tay `demo-data.json` / `demo-data.ts`: sửa `tools/gen-demo-data.mjs` rồi chạy lại.

## Quy mô

9 user (đủ 7 chức vụ), 27 hàng hoá (vật tư / thành phẩm / dịch vụ) kèm định mức, 5 NCC, 12 khách, 26 đơn bán, 40 lệnh sản xuất, 9 đơn nhập, 10 chuyến giao, 3 xe, 80 phiếu kho, 35 phiếu thu/chi.

## Quy tắc nghiệp vụ được mô phỏng

- **Trạng thái** theo `docs/crawl`: đơn bán `CHO_SAN_XUAT → DANG_SAN_XUAT → CHO_GIAO_HANG → DANG_GIAO → HOAN_THANH | GIAO_MOT_PHAN | TRA_TOAN_BO | HUY`; đơn nhập `NHAP → DA_GUI_NCC → NHAN_MOT_PHAN → DA_NHAN_DU → HOAN_TAT | HUY`; lệnh sản xuất `NHAP → DANG_SAN_XUAT → HOAN_TAT | HUY`; chuyến giao `GOM_DON → DA_XUAT_KHO → XE_VE_KHO → HOAN_TAT | HUY`.
- **Công nợ phải thu** chỉ ghi nhận theo số khách **thực nhận** (`receivedQuantity`, `receivedValue`, chiết khấu phân bổ theo tỷ lệ); hạn = ngày giao + số ngày được nợ.
- **Công nợ phải trả** ghi nhận theo hàng **đã nhận** của đơn nhập.
- **Đối trừ FIFO**: tiền thu/chi trừ vào khoản đến hạn sớm nhất; phần dư là "trả trước". Tuổi nợ chia 5 nhóm (chưa hạn, 1–30, 31–60, 61–90, >90). Xem `DebtService`.
- **Tồn kho** không âm: tồn đầu kỳ (phiếu kiểm kê 01/08/2026) được tính từ phần thiếu hụt khi chạy mô phỏng theo thời gian; 4 mặt hàng cố ý dưới tồn tối thiểu.
- Số dư quỹ luôn dương (có phiếu thu góp vốn đầu kỳ).

## Giả định / chưa xác minh

- Số ngày nợ NCC khi `creditAllowed` = **30 ngày** (bản gốc chưa xác minh).
- Prefix mã phiếu kho `PNK/PXK/PCK/PKK` và `PT/PC` suy từ docs; mã chuyến `CH`, lệnh `LSX`, đơn nhập `DN`, đơn bán `DH`.
- Dữ liệu demo không có giá vốn, nên "Lãi gộp" trên Tổng quan hiển thị `—`.
- Chưa chạy được `prisma validate` / `seed-demo` thật (chưa cài `node_modules` backend). Frontend đã qua `tsc` và `ngc --noEmit`.
- Đổi enum trong `schema.prisma` cần migration mới (`prisma migrate dev`).
