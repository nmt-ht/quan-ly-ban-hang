# Ninh Trang ERP — bàn giao cho Claude Code

Repo: `D:\Work\QuanLyBanHang-NinhTrang` (GitHub `nmt-ht/quan-ly-ban-hang`, nhánh `master`). Angular 22 + NestJS 12 + Prisma 7 + PostgreSQL (Neon), deploy Render.
Đọc trước: `README.md`, `docs/atlas`, và bản đồ kỹ thuật (artifact "Bản đồ kỹ thuật Ninh Trang").

## Trạng thái

| Mốc | Trạng thái | Patch |
|---|---|---|
| Pha 0 (gia cố nền) | Xong | `NinhTrang_Patch_Phase0_v1.patch` |
| Pha 1.7 hạn mức công nợ | Xong | `NinhTrang_Patch_Phase1-1_v1.patch` |
| Pha 1.5, 1.10, 1.3, 1.8 | Xong (24/10/2026), đã commit `1ace5a2` | — (working tree) |
| Pha 1.4 báo giá → đơn | Xong (24/10/2026), đã commit `1ace5a2` | — (working tree) |
| Pha 1.6 bảng giá + khuyến mãi | Xong (24/10/2026), đã commit `1ace5a2` | — (working tree) |
| Pha 1.9 nhập Excel có xem trước | Xong (24/10/2026), đã commit `1ace5a2` | — (working tree) |
| Pha 1.1 phân trang (đơn bán, phiếu kho, thu chi, đơn nhập) | Xong, `1b35e89` + `6ddf039` | — |
| Rà soát nghiệp vụ 25/10 (lỗ 1–10, 12, 13, theo MISA) | Xong, `3ed3216` + `f046988` | — |
| Giao diện: Tổng quan, ô chọn có tìm kiếm, màn tải, nhiều màu theo phân hệ | Xong, `5ea2a36` `654478c` `e607d2d` `5f13e6e` | — |
| Nhiều doanh nghiệp (mỗi DN một database, `/quan-tri-nen-tang`) | Xong, `46aeab8` — **chưa bật trên Render** | — |
| Sao lưu mọi doanh nghiệp | Xong, `fedeb1e` — chưa chạy thử trên GitHub Actions | — |
| Pha 1.2 ảnh sang object storage | Chưa làm | — |
| Pha 2: VietQR, thông báo công nợ, nhắc nợ | Xong (24/10/2026), đã commit `1ace5a2` | — (working tree) |
| Pha 2 còn lại (link theo dõi đơn, POD, hoá đơn điện tử, ticket, gửi tin tự động), Pha 3 | Chưa làm | xem `NinhTrang_Report_v1.md` (không có trong repo) |

Áp theo thứ tự, trong thư mục repo: `git apply <patch>` (Pha 0 trước), rồi `npm ci` ở `backend/` và `frontend/`.
Patch đã kiểm tra áp sạch lên commit `08cbde6`. Kết quả khi làm: 15 unit + 40 e2e xanh, lint không lỗi, build cả hai phía thành công.

## Tổng kết ngày 25/10/2026

Mọi commit dưới đây đã push lên `origin/master` (đỉnh `fedeb1e`).

**Đã làm**
- `6ddf039` Phân trang phía máy chủ đợt 2: phiếu kho, phiếu thu chi, đơn nhập (đã thử trên trình duyệt).
- `3ed3216` Lỗ nghiệp vụ 1–6: đơn huỷ sống lại qua chuyến, giao tay khi hàng trên xe, Sale sửa đơn người khác, giao không trừ kho, quy đổi lấy từ request, chiết khấu ngoài khuyến mãi (`order.discount`).
- `f046988` Kế toán theo MISA (lỗ 7–10, 12, 13): công nợ theo đợt giao / nhận, trả lại hàng mua (TLM), khoá sổ kỳ (`period.lock`), không chi vượt tồn quỹ (`voucher.overdraw`), chốt giao đúng tài xế, xem đơn cần `order.view`. Quyền: CEO 111 · Quản lý 102 · Kế toán 52.
- `5ea2a36`, `e607d2d` Trang Tổng quan mới (hero doanh thu, sparkline, biểu đồ 12 tháng, cơ cấu tồn); CSS tách 4 file cho vừa ngân sách 16 kB của build production.
- `654478c` Ô chọn có tìm kiếm cho mọi dropdown (sắp xếp tăng dần), thanh lọc gọn, màn khởi động và màn tải danh mục.
- `396fd5b` Viết lại README (quy trình nghiệp vụ, phân hệ, cách chạy, quy trình làm việc, triển khai).
- `46aeab8` **Nhiều doanh nghiệp**: bật khi đặt `PLATFORM_DATABASE_URL`; đăng nhập theo mã doanh nghiệp (`X-Tenant`, token mang `tid`); trang `/quan-tri-nen-tang` cho chủ nền tảng (mật khẩu + TOTP): tạo doanh nghiệp (tạo DB `nt_<mã>`, migrate, seed, tài khoản CEO, mật khẩu tạm hiện một lần), tạm ngưng / mở lại, cấp lại mật khẩu, đổi tên, cập nhật cấu trúc, nhật ký nền tảng chỉ ghi thêm. DB hiện tại thành doanh nghiệp `ninhtrang`. Mã: `backend/src/platform`, test `backend/test/platform.e2e-spec.ts`. README › Nhiều doanh nghiệp.
- `5f13e6e` (phiên Hallmark) Giao diện nhiều màu theo phân hệ, Tổng quan bố cục mới, menu tài khoản, Cần xử lý phân trang, top 10 bán chạy.

**Chưa xong / chưa kiểm**
- Sao lưu mọi doanh nghiệp (`fedeb1e`): đã commit và push, chưa chạy thật trên GitHub Actions.
- Giao diện `5f13e6e` chưa xem trên trình duyệt (build và test đạt).
- Nhiều doanh nghiệp chưa bật trên Render; chưa có trên trang nền tảng: dung lượng từng DB, số người dùng, lần dùng gần nhất. Màn khởi động (`index.html`) vẫn hiện tên công ty nhớ lần cuối, kể cả khi đổi mã doanh nghiệp.
- Lỗ nghiệp vụ còn lại: Sale vẫn hạ được đơn giá (không có giá sàn); huỷ phiếu thu vẫn có thể làm quỹ âm; NV xưởng không thấy đơn bán gốc trên lệnh SX.
- 1.1: chuyến giao, lệnh SX chưa phân trang phía máy chủ. 1.2 ảnh sang object storage chưa làm. Pha 2 còn: link theo dõi đơn, POD, hoá đơn điện tử, ticket, gửi tin tự động.
- In K80 trên máy in thật, quét VietQR bằng app ngân hàng thật: chưa thử.

**Kiến nghị sắp tới (theo thứ tự)**
1. Chạy tay workflow Backup DB một lần (cả chế độ một DB) **trước** khi bật nhiều doanh nghiệp: không thì DB doanh nghiệp mới không có bản sao lưu nào.
2. Bật nhiều doanh nghiệp trên Render: tạo sẵn chuỗi kết nối trực tiếp tới DB `platform` trên Neon, đặt 4 biến `PLATFORM_*` (cất `PLATFORM_SECRET` vào nơi an toàn, mất là không đọc được chuỗi kết nối), deploy, đăng ký TOTP, báo người dùng Ninh Trang nhập mã `ninhtrang` ở lần đăng nhập tới. Thêm secret `PLATFORM_DATABASE_URL`, `PLATFORM_SECRET` cho workflow sao lưu.
3. Theo dõi dung lượng Neon: gói miễn phí dùng chung một hạn mức lưu trữ cho mọi database của project; ảnh đang lưu dạng data URL trong DB nên 1.2 (R2/S3) giờ quan trọng hơn. Cân nhắc nâng gói khi có khách thật; Render free ngủ sau 15 phút cũng nên nâng cho khách trả tiền.
4. Xem lại giao diện mới trên trình duyệt (desktop + điện thoại), nhất là Tổng quan và menu tài khoản.
5. Đóng ba lỗ nghiệp vụ còn lại (giá sàn cho Sale theo MISA: không bán dưới giá tối thiểu trừ khi có quyền; chặn huỷ phiếu thu làm quỹ âm; cho xưởng xem đơn gốc chỉ đọc).
6. Trang nền tảng: thêm dung lượng DB, số người dùng, lần đăng nhập gần nhất của từng doanh nghiệp; xuất dữ liệu một doanh nghiệp (pg_dump) khi khách ngừng dùng.
7. Việc treo nhỏ: in K80 thật, quét VietQR thật, phân trang chuyến / lệnh SX khi số lượng lớn.

## Việc đầu tiên khi áp xong
1. Thêm secret GitHub `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`, chạy thử workflow Backup DB. Repo đang **công khai** nên file sao lưu phải mã hoá.
2. Render › Auto-Deploy › "After CI checks pass".
3. Tuỳ chọn: `SENTRY_DSN`, `SENTRY_FRONTEND_DSN`.

## Pha 1 còn lại (thứ tự đề xuất)
1. ~~**1.10 In ấn** + **1.5 Trả hàng bán**~~ — xong 24/10/2026 (xem README › Trả hàng bán, In ấn; `design.md` › Print).
2. ~~**1.3 Giá vốn chốt lúc xuất** + **1.8 Cảnh báo tồn tối thiểu**~~ — xong 24/10/2026 (migration `20261024120000_p1_3_moving_average_cost`; README › Giá vốn, Tồn tối thiểu).
3. ~~**1.4 Báo giá → đơn**~~ — xong 24/10/2026 (migration `20261024130000_p1_4_quotations`; README › Báo giá; quyền `quote.*`, CEO 104 · Quản lý 95 · Kế toán 49 · Sale 20). ~~**1.6 Bảng giá theo nhóm khách + khuyến mãi**~~ — xong 24/10/2026 (migration `20261024140000_p1_6_price_lists_promotions`; README › Bảng giá & khuyến mãi; quyền `pricelist.manage`, `promotion.manage` → CEO 106 · Quản lý 97). ~~**1.9 Import Excel**~~ — xong 24/10/2026: Khách hàng, Nhà cung cấp (mới) và Hàng hoá chạy thử trên máy chủ, lỗi từng dòng (README › Nhập Excel có xem trước). Chưa làm: nhập tồn kho đầu kỳ, nhập giá cho bảng giá.
4. **1.1 Phân trang phía máy chủ** — đang làm theo phương án "danh sách + nạp theo kỳ": ~~đợt 1 đơn hàng bán~~ xong 24/10/2026, ~~đợt 2 phiếu kho, phiếu thu chi, đơn nhập~~ xong 25/10/2026 (README › Phân trang phía máy chủ). Còn: chuyến / lệnh SX nếu cần; giá nhập gần nhất, hoạt động người dùng, Ctrl K vẫn chỉ tính trên phần đã nạp.
5. **1.2 Ảnh sang object storage** (cần chọn R2/S3 và cấp khoá).

### Việc nhỏ còn treo từ đợt 24/10/2026
- ~~**Commit**~~ — đã commit lên `master` ngày 24/10/2026 (`1ace5a2`, đã push lên GitHub). File brief này cố ý không commit (repo công khai).
- **In K80 trên máy in thật**: bố cục mới chỉ xem trên màn hình; cần in thử bằng máy in nhiệt 80 mm (driver khổ cuộn 80 mm, tắt "fit to page") để chắc trang dài đúng nội dung và máy cắt sau dòng cuối.
- ~~Hộp thoại Nhận hàng trả lại: kho mặc định~~ — xong 24/10/2026: theo dòng đầu tiên có số lượng trả, giữ kho chọn tay.
- ~~Tab Giá vốn của đơn bán~~ — xong 24/10/2026: `GET /api/sales-orders/:id/issued-costs` (`product.view_cost_price`), mặt hàng đã giao dùng giá đã chốt (nhãn "đã chốt"); đơn demo giao qua chuyến không có phiếu xuất nên vẫn hiện giá bình quân.
- Báo giá: đã bấm thử trên trình duyệt 24/10/2026 (BG0000007 → DH0000088 trên DB local): lập, bản in, Lập đơn điền sẵn giữ giá báo, lưu, BG "Đã lập đơn", tham chiếu hai chiều. Chưa in ra giấy thật.
- Khuyến mãi (1.6): chưa có báo cáo hiệu quả khuyến mãi (dữ liệu đã có: `promotionId` trên dòng/đơn). Từ 25/10/2026 server kiểm chiết khấu / hàng tặng theo khuyến mãi với người không có `order.discount` (xem README), nhưng vẫn không tự áp khuyến mãi khi gọi API thẳng. Màn Khuyến mãi chưa thử bấm tạo kiểu Tặng hàng/Bậc thang qua giao diện (đã thử qua API + unit test).
- Nhập Excel (1.9): định mức vẫn "tất cả hoặc không" ở máy chủ (chưa chạy thử từng dòng); hàng hoá vẫn đọc file ở trình duyệt nên ô trống trong cột có mặt = xoá giá trị (khác khách hàng/NCC: ô trống = giữ nguyên). Chưa bấm thử nhập NCC và hàng hoá qua giao diện (đã có e2e).
- Pha 2: đã bấm thử trên trình duyệt 24/10/2026 (tài khoản NH-9999 gắn Vietcombank; nhắc nợ KH0000007 qua Zalo, hẹn trả 31/10; thông báo công nợ có QR). Chưa quét mã VietQR bằng app ngân hàng thật (payload kiểm bằng unit test: trường, CRC); danh sách mã BIN trong `vietqr.ts` nên đối chiếu lại với NAPAS. Lưu ý: thư mục dự án có dấu nháy ("Tu's projects") làm dev server hỏng với `import()` động của gói CommonJS — `qrcode` được import tĩnh vì vậy.
- Tuỳ chọn: bản in "Phiếu trả hàng" riêng (hiện in qua phiếu kho "Nhập trả về").
- ~~Chi phí vật tư lệnh sản xuất~~ — xong 24/10/2026: báo cáo Sản xuất dùng giá đã chốt trên phiếu xuất vật tư; lệnh cũ chưa có thì ước tính và KPI ghi số lệnh ước tính.

Pha 2 (hỗ trợ khách hàng): ~~nhắc nợ, sao kê công nợ, VietQR~~ — xong 24/10/2026 (README › Pha 2; quyền `debt.remind` → CEO 107 · Quản lý 98 · Kế toán 50; gói frontend mới `qrcode`). Còn: link theo dõi đơn, POD (cần 1.2 object storage cho ảnh), hoá đơn điện tử (cần chọn nhà cung cấp + tài khoản API), ticket, gửi tin nhắc tự động (SMS brandname / Zalo OA). Chi tiết gốc ở `NinhTrang_Report_v1.md` — file này không có trong repo.

## Quy ước cần giữ (từ bản đồ kỹ thuật)
- Mọi thay đổi tồn kho đi qua `InventoryService.post(tx, …)`; mã chứng từ chỉ từ `SequenceService.nextCode`.
- Mọi thao tác ghi gọi `AuditService.log(tx, …)` trong cùng giao dịch, quên là e2e đỏ (`audit-coverage.setup.ts`).
- Không xoá chứng từ: huỷ (`isCancelled`) hoặc `isActive=false`.
- Công nợ và số dư quỹ tính khi đọc (`settle.ts`, `ReceivablesService`), không lưu cột số dư.
- Quyền mới: thêm vào `frontend/src/app/core/data/permission-catalog.ts` **và** `backend/prisma/seed.ts` (mã quyền, nhóm vai trò mặc định), rồi kiểm tra số quyền ở README/bản đồ.
- Ẩn/hiện theo quyền chỉ ở giao diện là chưa đủ, server phải chặn.
- Tiếng Việt có dấu đầy đủ trong thông báo và giao diện.

## Chạy và kiểm tra
```bash
cd backend
cp .env.example .env              # DATABASE_URL, JWT_SECRET, SEED_ADMIN_PASSWORD
npm run prisma:migrate && npm run prisma:seed
DEMO_USER_PASSWORD=demo1234 npm run prisma:seed:demo   # e2e cần dữ liệu demo
npm run lint && npm test && npm run test:e2e && npm run build
cd ../frontend && npm start        # cần Node >= 24.15; ng build để kiểm tra
```
Tài khoản demo: `quan.ly@`, `ke.toan@`, `sale1@`, `thu.kho@`, `tai.xe@ninhtrang.local` (mật khẩu `DEMO_USER_PASSWORD`), `admin@ninhtrang.local` (mật khẩu `SEED_ADMIN_PASSWORD`).

Lưu ý khi viết e2e với supertest: lấy token **trước** khi gọi `api()` cho request chính (dùng chung một http server, gọi lồng nhau sẽ ECONNREFUSED).

## Thay đổi Pha 0 + 1.7 đáng nhớ
- `GET /api/product-costs` (cần `product.view_cost_price` hoặc `stock.view_value`): `CostService` ở frontend lấy giá vốn từ đây, giao diện ẩn theo quyền.
- `POST /api/auth/change-password`; trang `/doi-mat-khau`; `authGuard` chuyển hướng khi `mustChangePassword`; từ 24/10/2026 máy chủ cũng chặn mọi API khác (`JwtAuthGuard`, chỉ cho `@AllowWhilePasswordChange` — /auth/me, /auth/change-password).
- Đăng nhập có throttle (`LOGIN_LIMIT_IP`, `LOGIN_LIMIT_ACCOUNT`; tắt khi `NODE_ENV=test` trừ khi đặt `E2E_THROTTLE`). helmet + CSP theo hash script inline của `index.html` (`common/security.ts`).
- `GET /api/health`, `GET /api/client-config`, `X-Request-Id`, Sentry tuỳ chọn (`backend/src/monitoring/`).
- Báo cáo `giao-hang`, `tai-xe` (`modules/reports/defs/ops.defs.ts` và bản khai báo phía frontend).
- `Customer.creditLimit` (migration `20261024100000_p1_credit_limit`); `SalesService.checkCredit`, `ReceivablesService.exposure`; cờ `overrideCreditLimit` cần `debt.adjust`.

## Còn tồn đọng đã biết
- Rà soát nghiệp vụ 25/10/2026: đã sửa (chưa commit) lỗ 1–6 — đơn huỷ "sống lại" qua chuyến, giao tay khi hàng đang trên xe, Sale sửa/huỷ đơn người khác, giao hàng không trừ kho, tỷ lệ quy đổi lấy từ request, chiết khấu ngoài khuyến mãi (quyền mới `order.discount`, CEO 108 · Quản lý 99); test `order-integrity.e2e-spec.ts`. Lỗ 7–10, 12, 13 sửa ngày 25/10/2026 theo nghiệp vụ MISA (chưa commit): công nợ theo từng đợt giao / nhận, trả lại hàng mua TLM…, khoá sổ kỳ kế toán, không chi vượt tồn quỹ, chốt giao đúng tài xế, xem đơn cần `order.view` (README › Nghiệp vụ kế toán theo MISA; test `period-and-returns.e2e-spec.ts`). Còn lại: Sale vẫn có `order.update_price` nên vẫn hạ đơn giá được (không có giá sàn); phiếu huỷ phiếu thu vẫn có thể làm quỹ âm (chỉ chặn phiếu chi); NV xưởng không còn thấy đơn bán gốc trên lệnh sản xuất (không có `order.view`).
- ~~Thủ kho thấy đơn giá đơn nhập~~ — xong 24/10/2026: `common/purchase-prices.ts` (máy chủ) + `core/auth/purchase-prices.ts` (giao diện) ẩn giá nhập trên đơn nhập, phiếu kho, danh mục hàng NCC với chức vụ không mua/duyệt/định giá/xem công nợ (Thủ kho, Sale, giao hàng, xưởng). Chưa bấm thử bằng tài khoản Thủ kho (có e2e).
- Lockfile tạo bằng npm 11.17.0 (`packageManager` trong `frontend/package.json`); npm cũ hơn sẽ báo lệch khi `npm ci`.
- Môi trường cloud không tải được engine Prisma; trên máy bạn dùng `prisma migrate` bình thường.
